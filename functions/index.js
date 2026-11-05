// GrowTogether push delivery.
//
// A phone with the app closed cannot be reached from the browser: only a server
// holding the VAPID private key may POST to the push service. These triggers are
// that server. They read the couple's own documents, build the same notification
// the page would have shown, and hand it to every subscription the receiving
// partner still has.
'use strict';

const admin = require('firebase-admin');
const webpush = require('web-push');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { endpointBisaDikirim } = require('./pushEndpoint');

admin.initializeApp();
const db = admin.firestore();

const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = defineSecret('VAPID_PUBLIC_KEY');
const VAPID_SUBJECT = defineSecret('VAPID_SUBJECT');

// A Firestore trigger has to live in the same region as the database, so the
// value is configurable instead of assumed.
const REGION = process.env.GT_FUNCTION_REGION || 'asia-southeast2';

const RUNTIME = {
  region: REGION,
  secrets: [VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT],
  timeoutSeconds: 60,
  memory: '128MiB',
  maxInstances: 10,
};

let vapidReady = false;
function readyVapid() {
  if (vapidReady) return true;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!privateKey || !publicKey || !subject) return false;
  try {
    // The push service requires a reachable contact in the VAPID subject.
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
    return true;
  } catch (error) {
    console.error('kunci VAPID ditolak web-push:', error.message);
    return false;
  }
}

const MOOD_WORDS = ['', 'lagi berat', 'agak berat', 'cukup baik', 'menyenangkan', 'luar biasa'];

function isoDate(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value.toISOString === 'function') return value.toISOString();
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  return undefined;
}

function stampOf(data) {
  const at = isoDate(data.createdAt) || isoDate(data.updatedAt);
  const parsed = Date.parse(at || '');
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function hugNotice(id, data) {
  const message = data.message || '';
  return {
    kind: 'hug',
    title: `${data.senderName || 'Pasanganmu'} mengirim semangat`,
    body: message || `${data.emoji || '🤗'}${data.habitTitle ? ` untuk ${data.habitTitle}` : ' untuk kamu'}.`,
    tag: `gt-hug-${id}`,
    tab: 'today',
    actions: [{ action: 'gt-reply-hug', title: 'Balas pelukan' }],
    when: stampOf(data),
  };
}

function checkInNotice(id, data) {
  const mood = MOOD_WORDS[data.mood] || 'sudah lewat';
  return {
    kind: 'checkin',
    title: `${data.userName || 'Pasanganmu'} sudah check-in`,
    body: data.gratitude ? `Harinya ${mood}. "${data.gratitude}"` : `Harinya ${mood}.`,
    tag: `gt-partner-checkin-${id}`,
    tab: 'couple',
    silent: true,
    when: stampOf(data),
  };
}

function journalNotice(id, data) {
  return {
    kind: 'journal',
    title: `Cerita baru dari ${data.authorName || 'pasanganmu'}`,
    body: data.whatWorked || data.nextWeekGoal || 'Menulis jurnal minggu ini.',
    tag: `gt-journal-${id}`,
    tab: 'couple',
    silent: true,
    when: stampOf(data),
  };
}

function agreementNotice(id, data) {
  const relief = data.pendingAction === 'relief';
  const swap = data.pendingAction === 'swap';
  return {
    kind: 'agreement',
    title: relief || swap ? 'Pasangan menunggu jawabanmu' : 'Kesepakatan menunggu persetujuanmu',
    body: `${data.creatorName || 'Pasangan'}: "${data.title}"${data.pendingNote ? ` — ${data.pendingNote}` : ''}`,
    tag: `gt-agreement-${id}`,
    tab: 'agreements',
    requireInteraction: true,
    when: stampOf(data),
  };
}

/** The room's other half. Older rows keep the profiles inline, so the ids are
 *  taken from the couple document and never guessed from the writer. */
async function partnerOf(coupleId, senderId) {
  if (!coupleId || typeof coupleId !== 'string') return null;
  const couple = await db.collection('couples').doc(coupleId).get();
  if (!couple.exists) return null;
  const { user1Id, user2Id } = couple.data();
  if (user1Id === senderId) return user2Id || null;
  if (user2Id === senderId) return user1Id || null;
  return null;
}

async function subscriptionsFor(userId, kind) {
  if (!userId || typeof userId !== 'string') return [];
  const snapshot = await db
    .collection('pushSubscriptions')
    .where('ownerId', '==', userId)
    .get();
  return snapshot.docs.filter((doc) => {
    const prefs = doc.data().prefs;
    return !prefs || prefs[kind] !== false;
  });
}

/** One dead subscription must not fail the whole couple, and a subscription the
 *  push service no longer knows about is deleted so the next attempt is cheap. */
async function sendTo(sub, payload) {
  const endpoint = sub.data().endpoint;
  const keys = sub.data().keys || {};
  if (!endpoint || !keys.p256dh || !keys.auth) return 'incomplete';
  if (!endpointBisaDikirim(endpoint, process.env.GT_PUSH_ALLOW_LOCAL === '1')) {
    console.warn('alamat push ditolak (bukan https atau alamat internal):', new URL(endpoint).host);
    return 'blocked';
  }
  try {
    await webpush.sendNotification({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }, payload);
    return 'sent';
  } catch (error) {
    const code = error && error.statusCode;
    if (code === 404 || code === 410) {
      await sub.ref.delete().catch((deleteError) => {
        console.error('langganan mati gagal dibersihkan:', deleteError && deleteError.message);
      });
      return 'expired';
    }
    return 'failed';
  }
}

async function pushTo(userId, notification) {
  if (!readyVapid()) {
    console.error('VAPID key belum terpasang; kabar tidak bisa dikirim ke HP tertutup.');
    return { delivered: 0, reason: 'no-vapid' };
  }
  const subs = await subscriptionsFor(userId, notification.kind);
  if (!subs.length) return { delivered: 0, reason: 'no-subscription' };
  const payload = JSON.stringify(notification);
  const outcomes = await Promise.all(subs.map((sub) => sendTo(sub, payload)));
  const delivered = outcomes.filter((outcome) => outcome === 'sent').length;
  return { delivered, reason: null, outcomes };
}

// News that waits for the app to be opened again is still news; news that the
// partner already answered must not wake them a second time.
function needsDecision(data) {
  if (!data) return false;
  return (data.status === 'pending_approval' && data.partnerApproved !== true) || !!data.pendingAction;
}

exports.pushHugToPartner = onDocumentCreated({
  ...RUNTIME,
  document: 'reactions/{reactionId}',
}, async (event) => {
  const data = event.data && event.data.data();
  if (!data) return;
  const sender = data.senderId;
  const receiver = data.receiverId || (await partnerOf(data.coupleId, sender));
  if (!receiver || receiver === sender) return;
  const result = await pushTo(receiver, hugNotice(event.params.reactionId, data));
  console.log(`push hug -> ${receiver}`, JSON.stringify(result));
});

exports.pushCheckInToPartner = onDocumentCreated({
  ...RUNTIME,
  document: 'checkins/{checkinId}',
}, async (event) => {
  const data = event.data && event.data.data();
  if (!data || data.isShared !== true) return;
  const partner = await partnerOf(data.coupleId, data.userId);
  if (!partner) return;
  const result = await pushTo(partner, checkInNotice(event.params.checkinId, data));
  console.log(`push check-in -> ${partner}`, JSON.stringify(result));
});

exports.pushJournalToPartner = onDocumentCreated({
  ...RUNTIME,
  document: 'journals/{journalId}',
}, async (event) => {
  const data = event.data && event.data.data();
  if (!data || data.isShared !== true) return;
  const partner = await partnerOf(data.coupleId, data.authorId);
  if (!partner) return;
  const result = await pushTo(partner, journalNotice(event.params.journalId, data));
  console.log(`push jurnal -> ${partner}`, JSON.stringify(result));
});

exports.pushAgreementToPartner = onDocumentCreated({
  ...RUNTIME,
  document: 'agreements/{agreementId}',
}, async (event) => {
  const data = event.data && event.data.data();
  if (!data || !needsDecision(data)) return;
  const partner = await partnerOf(data.coupleId, data.creatorId);
  if (!partner) return;
  const result = await pushTo(partner, agreementNotice(event.params.agreementId, data));
  console.log(`push kesepakatan -> ${partner}`, JSON.stringify(result));
});

// A relief request or a swapped sanction arrives as an update, not a new row, so
// only the moment the question first appears is worth a wake-up.
exports.pushAgreementUpdateToPartner = onDocumentUpdated({
  ...RUNTIME,
  document: 'agreements/{agreementId}',
}, async (event) => {
  const before = event.data && event.data.before.data();
  const after = event.data && event.data.after.data();
  if (!after || !needsDecision(after) || needsDecision(before)) return;
  const partner = await partnerOf(after.coupleId, after.creatorId);
  if (!partner) return;
  const result = await pushTo(partner, agreementNotice(event.params.agreementId, after));
  console.log(`push perubahan kesepakatan -> ${partner}`, JSON.stringify(result));
});
