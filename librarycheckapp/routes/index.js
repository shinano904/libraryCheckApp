const express = require('express');
const wishScraper = require('../models/wishListScraper');
const { PRODUCT_ISBN_FLG } = require('../common/constants');
const app = express();
const config = require('../config.json')[app.get('env')];
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  (async () => {
    const wishListItems = await wishScraper.getAmazonWithList(config.wishlistid);
    res.render('index', {items: wishListItems, title: "図書館チェック", productIsbnFlg : PRODUCT_ISBN_FLG});
  })()
  .catch(function (error) {
    console.error(error);
    res.render('index', {items: {}, title: "図書館チェック(エラー)", productIsbnFlg : PRODUCT_ISBN_FLG});
  });
});

module.exports = router;
