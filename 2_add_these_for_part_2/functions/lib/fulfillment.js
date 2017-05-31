const assert = require('assert');
const co = require("co");
const moment = require("moment");
const shortid = require("shortid");
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_@');

//this file is *slightly* different than what you see at the start of part 3
class Fulfillment{

  constructor(args){
    assert(args.db, "Need a database instance");
    assert(args.sale, "Need a sale");
    assert(args.sale.transaction, "There's no transaction for sale");
    this.db = args.db;
    this.sale = args.sale;
  }

  provisionItems(){
    const order = this.sale.order;
    //const downloads = [];
    const fulfillment = {};
    for(var item of order.items){
      //is a download?
      if(item.product && item.product.download){
        const dl = item.product.download;
        const id = shortid.generate();
        //set this as a property; it's easier
        //for firebase
        fulfillment[id] = {
          id: id, //for finding
          type: "download",
          name: item.product.name,
          image: item.product.image,
          quantity: item.quantity,
          limit: dl.limit,
          expires: dl.expires || "never",
          fileName: dl.fileName,
          size: dl.size,
          description: dl.fileDescription || "",
          bucket: dl.bucket || "downloads",
        };
      }
    }
    //tick the progress
    this.sale.fulfillment = fulfillment;
    this.sale.progress.fulfilled = true;
    return this.db.updateSale(this.sale.id,{
      progress: this.sale.progress,
      fulfillment: this.sale.fulfillment
    });
  }

  createInvoice(){
    assert(this.sale.fulfillment, "Provision this fulfillment first");
    const sale = this.sale;
    const order = sale.order;
    const invoice = {
      deliverables : {},
      customer : {
        email : sale.customer.email,
        name: sale.customer.name
      },
      amountDue : order.amountDue,
      amountPaid : sale.amountPaid,
      transaction_id : sale.transaction.id,
      created_at : moment().format("YYYY-MM-DD hh:mm"),
      timestamp : moment().unix(),
      paymentDetails : null,
      billTo : null,
      //put in the DB if it makes you feel better
      payTo : `Red:4 Aerospace,
  111 S. Jackson
  Seattle, WA 98104
  USA`
    }

    //other processor might be paypal, for instance
    if(sale.processor === "stripe"){
      const card = sale.payment.card;
      invoice.customer.name = sale.customer.name || card.name;
      invoice.billToLines = [
        card.name,
        card.address_line1 || "",
        card.address_line2 || "",
        card.address_city || "",
        card.country || "",
        card.address_zip || "",
      ]
      //make it pretty for the screen
      invoice.billTo = invoice.billToLines.filter(s => s && s != "" > 0).join("\n");
      invoice.paymentDetails = {
        method: "Credit Card",
        type: card.brand,
        last4: card.last4,
      }
    }

    //set the deliverables on the invoice. This is **customer-facing**
    const downloadIds = Object.keys(sale.fulfillment);
    if(downloadIds.length > 0){
      for(var id of downloadIds){
        const item = sale.fulfillment[id];
        console.log("Setting ", item);
        invoice.deliverables[id] = {
          name: item.name,
          downloadCount: 0,
          downloadsRemaining: item.limit,
          downloadUrl: `https://us-central1-red4-50295.cloudfunctions.net/download?oid=${sale.id}&id=${id}`,
          quantity: item.quantity,
          image: item.image,
          limit: item.limit,
          size: item.size,
          description: item.description || ""
        };
      }
    }
    //tick the progress
    sale.progress.invoiced = true;
    console.log(invoice)
    sale.invoice = invoice;
    //partial update
    return this.db.updateSale(sale.id, {
      progress: sale.progress,
      invoice: sale.invoice,
    });
  }
}

exports.forNewSale = (args) => {
  return new Fulfillment(args);
}