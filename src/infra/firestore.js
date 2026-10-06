const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore({
    projectId:'sapo-amis-sync',
    databaseId:'sapo-amis-sync'
})

module.exports = db;