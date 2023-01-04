var express = require('express');
const request = require('request');
const wishScraper = require('../models/wishListScraper');
const { WISH_LIST_ID, CALIL_API_URL } = require('../common/constants');

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  (async () => {
    // amazonの欲しいものリストを取得
    const itemList = await wishScraper.getItemList(WISH_LIST_ID);
    var data = {
        items: itemList
    };
  
    // 蔵書状況を取得
    getLibraryInfo(itemList);

  
    // 画面表示用の連想配列作成



    res.render('index', data);
  })().catch(next);
  
  
});

/**
 * 蔵書状況を取得
 */
function getLibraryInfo(itemList) {
  // ISBNをカンマ区切り
  const productAsinArray = itemList.map((row) => {
    return [row['productAsin']]
  });
  const isbn = productAsinArray.join(',');
  console.log(isbn);

  request.get({
      uri: CALIL_API_URL,
      headers: {'Content-type': 'application/json'},
      qs: {
          // GETのURLの後に付く
          appkey : '',
          isbn : isbn,
          systemid : '',
          format : 'json',
          callback : 'no'
      },
      json: true
  }, function(err, req, data){
      // json変換

      console.log(data);
  });
  
}

module.exports = router;
