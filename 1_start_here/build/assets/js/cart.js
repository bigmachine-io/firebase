function shortid(length) {
  return Math.random().toString(36).substring(2, 4) + Math.random().toString(36).substring(2, 4);
};

var CartItem = function(args){
  this.sku = args.sku;
  this.processing = false;
  this.name = args.name;
  this.description = args.description || "";
  this.price = parseInt(args.price) || 0;
  this.discount = 0;
  this.image = args.image || "";
  this.priceFormatted = function(){
    return accounting.formatMoney(this.price/100);
  };
  this.quantity = args.quantity || 1;
  this.lineTotal = function(){
    return this.quantity * (this.price - this.discount);
  };
};
var Cart = {
  processor: "",
  total: 0,
  items: [],
  discount: {},
  payment: null,
  addItem: function(item, quantity=1){
    var found = this.findItem(item.sku);
    if(found){
      found.quantity+=quantity;
    }else{
      this.items.push(new CartItem(item));
    }
    this.setTotals();
    this.save();
  },
  findItem: function(sku){
    var found = this.items.filter(function(item){
      return item.sku === sku;
    });
    if(found){
      return found[0];
    }else{
      return null;
    }
  },
  removeItem: function(sku){
    var found = this.findItem(sku);
    if(found){
      var foundIndex = this.items.indexOf(found);
      this.items.splice(foundIndex,1);
    }
    this.setTotals();
    this.save();
  },
  save: function(){
    localStorage.setItem("redfourCart", JSON.stringify(this.items));
  },
  load: function(){
    this.items = [];
    var items = JSON.parse(localStorage.getItem("redfourCart"));
    for(var item of items){
      this.items.push(new CartItem(item));
    }
    this.setTotals();
    this.generateId();
    return this;
  },
  setTotals : function(){
    this.total = 0;
    for(var item of this.items){
      this.total+=item.lineTotal();
    }
  },
  asJSON: function(){
    return JSON.parse(JSON.stringify(this))
  },
  generateId : function(){
    const formattedDate = moment().format('YYYYMMDD-HHmm');
    const key = shortid(4);
    const id =  `RED4-${formattedDate}-${key}`;
    this.orderId = id;
  }
};