const admin = require("firebase-admin");
const Emitter = require("events").EventEmitter;
const assert = require('assert');
const shortid = require("shortid");
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_@');
var cert = require("./cert.json");
admin.initializeApp({
  credential: admin.credential.cert(cert),
  databaseURL: `https://red4-50295.firebaseio.com`
});
class DB extends Emitter{
  constructor(args){
    super();
    assert(args.path, "Need a path set at least");
    this.path = args.path;
    if(args.listen) this.listen();
    this.data = [];
  }
  ref(){
    return admin.database().ref(`/${this.path}`); 
  }
  all(){
    return admin.database().ref(`/${this.path}`).once("value").then(res => {
      return Promise.resolve(res.val());
    }).catch(err => Promise.reject(err)); 
  }
  last(limit=100){
    return admin.database().ref(`/${this.path}`)
      .orderByKey()
      .limitToLast(limit)
      .once("value")
      .then(snap => {
        const out = [];
        snap.forEach(item => {
          out.push(item.val())
        });
        return Promise.resolve(out);
      })
      .catch(err => Promise.reject(err));
  }
  find(key, val, opts={}){
    return admin.database().ref(`/${this.path}`)
      .orderByChild(key)
      .equalTo(val)
      .once("value")
      .then(snap => {
        let out = [];
        snap.forEach(x => {
          out.push(x.val())
        });

        if(opts.single){
          return Promise.resolve(out[0]);
        }else{
          return Promise.resolve(out);
        }

      })
      .catch(err => Promise.reject(err));
  }
  filter(key, args={}, opts={}){
    assert(args.startsWith || args.endsWith, "Need a startsWith and/or endsWith");
    const query = admin.database().ref(`/${this.path}`)
      .orderByChild(key);

    if(args.startsWith) query.startAt(args.startsWith);
    if(args.endsWith) query.endAt(args.endsWith);

    return query.once("value")
      .then(snap => {
        const out = [];
        snap.forEach(item => out.push(item.val()));
        if(opts.single){
          return Promise.resolve(out[0]);
        }else{
          return Promise.resolve(out);
        }
      })
      .catch(err => Promise.reject(err));
  }
  get(id){
    return admin.database().ref(`/${this.path}/${id}`).once("value")
      .then(snap => Promise.resolve(snap.val()))
      .catch(err => Promise.reject(err));
  }
  getMany(keys){
    const promises = [];
    for(var key of keys){
      promises.push(this.get(key));
    }
    return Promise.all(promises);
  }
  update(id, args){
    return admin.database().ref(`/${this.path}/${id}`).update(args);
  }
  delete(id){
    return admin.database().ref(`/${this.path}/${id}`).remove();
  }
  save(data){
    if(!data.id) data.id = shortid.generate();
    return admin.database().ref(`/${this.path}/${data.id}`).set(data);
  }
  saveMany(items){
    const promises = [];
    for(let item of items){
      promises.push(this.save(item));
    }
    return Promise.all(promises);
  }
  pushMany(key, items){
    const promises = [];
    for(let item of items){
      if(item.id){
        promises.push(admin.database().ref(`/${this.path}/${key}/${item.id}`).set(item));
      }else{
        promises.push(admin.database().ref(`/${this.path}/${key}`).push(item));
      }

    }
    return Promise.all(promises);
  }
  listen(){
    admin.database().ref(`/${this.path}`).on("child_changed", snap => this.emit("change", snap.val()));
    admin.database().ref(`/${this.path}`).on("child_removed", snap => this.emit("remove", snap.val()));
    admin.database().ref(`/${this.path}`).on("child_added", snap => this.emit("add", snap.val()));
  }
}

module.exports = DB;

