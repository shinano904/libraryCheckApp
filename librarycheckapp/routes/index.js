var express = require('express');
const request = require('request');
const wishScraper = require('../models/wishListScraper');
const { CALIL_API_URL } = require('../common/constants');
const e = require('express');
var app = express();
var config = require('../config.json')[app.get('env')];

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  (async () => {
    // amazonの欲しいものリストを取得
    const itemList = await wishScraper.getItemList(config.wishlistid);
    
    // ISBN取得
    
    // 蔵書状況を取得
    const libraryInfo = await getLibraryInfo(itemList);
    console.log("libraryInfo: " + JSON.stringify(libraryInfo));

    var data = {
      items: libraryInfo
    };
    // 画面表示用の連想配列作成



    res.render('index', data);
  })().catch(next);
  
  
});

/**
 * 蔵書状況を取得
 */
async function getLibraryInfo(itemList) {
  // ISBNをカンマ区切り
  const productAsinArray = itemList.map((row) => {
    return [row['productAsin']]
  });
  const isbn = productAsinArray.join(',');
  console.log(isbn);

  let qStr = {
      appkey : config.calilappkey,
      isbn : isbn,
      systemid : 'Aichi_Kariya',
      format : 'json',
      callback : 'no'
  };

  let timeout = ms => new Promise(done => setTimeout( done, ms ));
  let countinue = true;
  let items = {};
  while ( countinue ) {
    request.get({
      uri: CALIL_API_URL,
      headers: {'Content-type': 'application/json'},
      qs: qStr,
      json: true
    }, function(err, req, data){
        console.log('json.continue: %s', data.continue);
        if (data.continue == 0) {
          // 蔵書情報取得
          const books = data.books;
          console.log(books);
          
          items = Object.keys(books).map(function (isbn) {           
            const item = itemList.find(element => element['productAsin'] == isbn);
            return {
              itemId : item.itemId, 
              productPrice : item.productPrice, 
              productName : item.productName, 
              productAsin : item.productAsin,
              authorName : item.authorName,
              imageUrl : item.imageUrl,
              amazonUrl : item.amazonUrl,
              reserveurl : books[isbn].Aichi_Kariya.reserveurl,
              libkey : books[isbn].Aichi_Kariya.libkey
            }
          });
          
          countinue = false;
          // console.log("libraryInfo: " + JSON.stringify(items));
          
        } else {
          // 再度API送信
          qStr = {
            // TODO:: configにする
            appkey : config.calilappkey,
            session : data.session,
            format : 'json',
            callback : 'no'
          };
        }
    });
    await timeout( 5000 );
  }

  return items;
}

module.exports = router;
