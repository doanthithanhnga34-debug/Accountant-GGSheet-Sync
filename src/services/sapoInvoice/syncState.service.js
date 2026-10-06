const db = require("../../infra/firestore");
const COLLECTION = "sync_state";
const DOCUMENT = "batch";
const DEFAULT_STATE = {
  nextPage: 1,
  nextRow:2
};
async function get() {
  const ref = db.collection(COLLECTION).doc(DOCUMENT);
  const doc = await ref.get();
  if (!doc.exists) {
    return {
      ...DEFAULT_STATE,
    };
  }
  const data = doc.data();
  return {
    ...DEFAULT_STATE,
    ...data,
  };
}

async function set(changes = {}) {
  const ref =  db.collection(COLLECTION).doc(DOCUMENT);
  await ref.set({
    ...changes,
    updateAt:new Date().toDateString()
  }, {
    merge: true,
  });
  return true;
}

const invoiceSyncState = {
    get,
    set
}
module.exports = invoiceSyncState
