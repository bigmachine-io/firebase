const path = require("path");
const keyFilename=(path.resolve(__dirname,"./db/cert.json"));//the service cert
const projectId = "red4-50295" //replace with your project id
const assert = require('assert');
const co = require("co");
const moment = require("moment");

//init with settings
const gcs = require('@google-cloud/storage')({ //confusing
    projectId,
    keyFilename
});

class Downloader{
  constructor(args){
    assert(args.db, "Need a db instance");
    const bucketName = args.bucket || `${projectId}.appspot.com`;
    this.bucket = gcs.bucket(bucketName);
    this.db = args.db;
  }

  generateSignedUrl(download){
    const file = this.bucket.file(`downloads/${download.fileName}`);
    const date = new Date();
    return file.getSignedUrl({
      action: 'read',
      expires: date.setDate(date.getDate() + 1) //expire it in 24 hours
    }).then(urls => {
      if(urls.length > 0) {
        download.url =urls[0]; 
        return Promise.resolve(urls[0])
      }
    });
  }


  processDownload(orderId, downloadId){
    const self = this; //lose context in co
    return co(function*(){
      const download = yield self.db.getDownload(orderId,downloadId);
      const invoice = yield self.db.getInvoice(orderId);
      if(download.id && invoice){
        const item = invoice.deliverables[downloadId];
        if(item.downloadsRemaining > 0){
          //generate a URL
          const url = yield self.generateSignedUrl(download);
          //tick the stats
          item.downloadCount++;
          item.downloadsRemaining--;
          const logs = item.logs || [];
          const log = {
            date: moment().format("YYYY-MM-DD HH:mm"),
            entry: `Downloaded ${download.fileName}`
          };
          const ref = self.db.deliverableRef(orderId, download.id);
          //update the numbers
          yield ref.update({
            downloadCount: item.downloadCount,
            downloadsRemaining : item.downloadsRemaining
          });
          yield ref.child("logs").push(log);

          return url;
        }else{
          console.log("Bummer no more downloads")
          return false;
        }
      }else{
        console.log("No download there")
        return false;
      } 
    });
  }

}
exports.init = args => new Downloader(args);