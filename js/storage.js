import firebase from 'firebase/app'
import 'firebase/database'
import uuidv4 from 'uuid/v4'

export function initDatabase () {
  firebase.initializeApp({
    apiKey: 'AIzaSyDtCksjwncWyhTsZkMkIzct--e-lo3YHZU',
    authDomain: 'plate-tectonics-3d.firebaseapp.com',
    databaseURL: 'https://plate-tectonics-3d.firebaseio.com',
    projectId: 'plate-tectonics-3d',
    storageBucket: 'plate-tectonics-3d.appspot.com',
    messagingSenderId: '89180504646'
  })
}

export function saveModelToCloud (serializedModel, callback) {
  const db = firebase.database()
  const uuid = uuidv4()

  db.ref('models/' + uuid).set({
    model: serializedModel
  }, function () {
    callback(uuid)
  })
}

export function loadModelFromCloud (modelId, callback) {
  const db = firebase.database()
  const ref = db.ref('models/' + modelId)

  ref.once('value', function (data) {
    callback(data.val().model)
  })
}
