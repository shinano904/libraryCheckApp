var express = require('express');
const axios = require('axios');
const wishScraper = require('../models/wishListScraper');
const { CALIL_API_URL, GOOGLE_API_URL } = require('../common/constants');
var app = express();
var config = require('../config.json')[app.get('env')];

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  (async () => {
    // amazonの欲しいものリストを取得
    const itemList = await wishScraper.getItemList(config.wishlistid);
    
    // ISBN取得
    const isbnInfo = await getIsbnInfo(itemList);

    // 蔵書状況を取得
    const libraryInfo = await getLibraryInfo(isbnInfo);

    res.render('index', {items: libraryInfo});
  })().catch(next);
});

/**
 * ISBNを取得
 */
async function getIsbnInfo(itemList) {
  console.log("getIsbnInfo");
  let axiosArr = new Array();
  var asinArr = new Object();
  let count = 0;
  let resultArr = new Array();

  itemList.forEach((item,index) => {
    if (item.authorName.indexOf('(Kindle版)') != -1) {
      const title = item.productName.indexOf(' ') != -1 ? item.productName.substr(0, item.productName.indexOf(' ')) : item.productName;
      const author = item.authorName.indexOf(',') != -1 ? item.authorName.substr(0, item.authorName.indexOf(',')) : item.authorName;

      axiosArr[count] = axios.get(GOOGLE_API_URL, {params:{
        q : 'intitle:' + title + '+inauthor:' + author.replace('(Kindle版)', '').trim()
      }});

      asinArr[count] = item.productAsin;
      count++;
    } else {
      resultArr.push(
        {
          itemId : item.itemId, 
          productPrice : item.productPrice, 
          productName : item.productName, 
          productAsin : item.productAsin,
          authorName : item.authorName,
          imageUrl : item.imageUrl,
          amazonUrl : item.amazonUrl,
          productIsbnFlg : 'OK'
        }
      );
    }
  });

  console.log("count %s" ,axiosArr.length);
  const results = await Promise.all(axiosArr);
  
  results.forEach((response, index) => {
    
    let asin = asinArr[index];
    let isbnFlg = 'NG';
    const item = itemList.find(element => element['productAsin'] == asin);

    if (Number(response.data.totalItems) >= 1) {
      for(let element of response.data.items[0].volumeInfo.industryIdentifiers){
        if (element.type == 'ISBN_10') {
          asin = element.identifier;
          isbnFlg = 'OK'
          break;
        }
      }
    }
    
    resultArr.push(
      {
        itemId : item.itemId, 
        productPrice : item.productPrice, 
        productName : item.productName, 
        productAsin : asin,
        authorName : item.authorName,
        imageUrl : item.imageUrl,
        amazonUrl : item.amazonUrl,
        productIsbnFlg : isbnFlg
      }
    );
  });

  console.log("resultArr: %s", JSON.stringify(resultArr,null,'\t'));
  return resultArr;
}


/**
 * 蔵書状況を取得
 */
async function getLibraryInfo(itemList) {
  console.log("getLibraryInfo");
  // ISBNをカンマ区切り
  const productAsinArray = itemList.map((row) => {
      return [row['productAsin']];
  });
  const isbn = productAsinArray.join(',');
  console.log(isbn);

  let qStr = {
      appkey : config.calilappkey,
      isbn : isbn,
      systemid : config.calilsystemid,
      format : 'json',
      callback : 'no'
  };
  
  let timeout = ms => new Promise(done => setTimeout( done, ms ));
  let countinue = true;
  let items = {};
  while ( countinue ) {
    (async () => { 
          await axios.get(CALIL_API_URL, {
              params:qStr
          })
          .then(function (response) {
            // handle success
            console.log('json.continue: %s', response.data.continue);
            if (response.data.continue == 0) {
              const books = response.data.books;
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
                  productIsbnFlg : item.productIsbnFlg,
                  reserveurl : books[isbn].Aichi_Kariya.reserveurl,
                  libkey : books[isbn].Aichi_Kariya.libkey
                }
              });
              
              countinue = false;
              
            } else {
              // 再度API送信
              qStr = {
                appkey : config.calilappkey,
                session : response.data.session,
                format : 'json',
                callback : 'no'
              };
            }
          })
          .catch(function (error) {
            // handle error
            console.log(error);
          })
          .finally(function () {
            // always executed
          });
        })();
    await timeout( 5000 );
  }
  return items;
}

module.exports = router;
