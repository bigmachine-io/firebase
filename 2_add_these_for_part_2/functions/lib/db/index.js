const assert = require("assert");
const functions = require('firebase-functions');
const Firebase = require("./fuego");
const salesDb = new Firebase({path: "sales"});
const catalogDb = new Firebase({path: "catalog"});
const pgp = require("pg-promise")();
const db = pgp(functions.config().pg.url);
const geo = require("geoip-lite");
const moment = require("moment");

//a bit of a repo
exports.getProducts = skus => {
  return catalogDb.getMany(skus);
}

exports.createSale = sale => {
  return salesDb.save(sale);
}

exports.getSale = (id) => {
  return salesDb.get(id);
}

exports.updateSale = (id, updates) => {
  return salesDb.update(id, updates)
}

exports.getDownloadRef = (orderId, downloadId) => {
  return salesDb.ref().child(`${orderId}/fulfillment/${downloadId}`);
}

exports.getSaleByTransaction = (tx_id) => {
  return salesDb.find("transaction/id",tx_id).then(result => {
    if(result && result.length > 0) return Promise.resolve(result[0]);
    else return Promise.reject("No transaction with that ID");
  });
}

exports.getDownload = (orderId, downloadId) => {
  const ref = this.getDownloadRef(orderId, downloadId);
  return ref.once("value").then(res => Promise.resolve(res.val()));
}
exports.getInvoice = (orderId) => {
  return salesDb.ref().child(`${orderId}/invoice`).once("value").then(res => Promise.resolve(res.val()));
}
exports.deliverableRef = (orderId, itemId) => {
  return salesDb.ref().child(`${orderId}/invoice/deliverables/${itemId}`);
}

exports.exportSale = sale => {
  //sending this to compose... we're paranoid
  const sql = `insert into checkouts(id, total,email,customer, fulfillment, geo, invoice, ip, notification, purchase_order, payment, processor, transaction) 
              values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
              on conflict (id) do update set customer = EXCLUDED.customer, fulfillment = EXCLUDED.fulfillment, invoice = EXCLUDED.invoice, payment = EXCLUDED.payment, transaction = EXCLUDED.transaction`;
  return db.none(sql, [
      sale.id,
      sale.amountPaid,
      sale.customer.email,
      sale.customer,
      sale.fulfillment,
      sale.geo,
      sale.invoice,
      sale.ip,
      sale.notification,
      sale.order,
      sale.payment,
      sale.processor,
      sale.transaction
    ]);

}