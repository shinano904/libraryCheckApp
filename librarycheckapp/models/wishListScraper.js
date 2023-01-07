const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const app = express();
const config = require('../config.json')[app.get('env')];
const { URL_BASE, IMAGE_URL, AMAZON_PRODUCT_URL, SELECTORS, ASIN, CALIL_API_URL, GOOGLE_API_URL, PRODUCT_ISBN_FLG } = require('../common/constants');


async function getAmazonWithList(wishListId) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.goto(URL_BASE + wishListId);
    await page.reload({ waitUntil: 'networkidle0' });
    const html = await getProductsScrollingToTheEndOfPage(page);
    const wishListItems = readWishlist(html);
    await browser.close();
    const wishListItemsReplacedIsbn = await replaceKindleVersionIsbn(wishListItems);
    const wishListLibraryInfo = await getLibraryInfo(wishListItemsReplacedIsbn);
    return wishListLibraryInfo;
  } catch (error) {
    throw error;
  } finally {
    browser.close();
  }
}

async function getProductsScrollingToTheEndOfPage(page) {
  return await page.evaluate(async () => {
    const result = await new Promise((resolve, reject) => {
      let totalHeight = 0;
      let distance = 100;
      let timer = setInterval(() => {
        let scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve(document);
        }
      }, 100);
    });

    return result.querySelector('#g-items').innerHTML;
  });
}

const readWishlist = (html) => {
  const $ = cheerio.load(html);

  let items = $(SELECTORS.wishlistItemDiv).map(function () {
    const $element = $(this);
    const itemId = $element.attr()['data-itemid'];
    const productPrice = changeYen(parseFloat($element.attr()['data-price']));
    const productReposionJson = $element.attr()['data-reposition-action-params'];
    const asin = JSON.parse(productReposionJson).itemExternalId;
    const productAsin = asin.slice(ASIN.start, ASIN.end);

    const linkElement = $element.find(SELECTORS.wishlistItemName(itemId));
    const productName = linkElement.text().trim();

    const byLineElement = $element.find(SELECTORS.wishlistItemByLine(itemId));
    const authorName = byLineElement.text().trim();
    // authorNameがない場合は本でないとみなす
    if (authorName == "") {
      return;
    }
    const imageUrl = IMAGE_URL(productAsin);
    const amazonUrl = AMAZON_PRODUCT_URL(productAsin);

    return createWishListItem(
      itemId,
      productPrice,
      productName,
      productAsin,
      authorName,
      imageUrl,
      amazonUrl
    )
  }).get().filter(v => v);

  return items;
};

function changeYen(num) {
  return '¥' + String(num).split("").reverse().join("").match(/\d{1,3}/g).join(",").split("").reverse().join("");
}

async function replaceKindleVersionIsbn(itemList) {
  const axiosArr = new Array();
  const asinArr = new Object();
  let count = 0;
  const resultArr = new Array();
  const kindleVerStr = '(Kindle版)';
  try {
    itemList.forEach((item) => {
      if (item.authorName.indexOf(kindleVerStr) != -1) {
        const title = item.productName.indexOf(' ') != -1 ? item.productName.substr(0, item.productName.indexOf(' ')) : item.productName;
        const author = item.authorName.indexOf(',') != -1 ? item.authorName.substr(0, item.authorName.indexOf(',')) : item.authorName;

        axiosArr[count] = axios.get(GOOGLE_API_URL, {
          params: {
            q: 'intitle:' + title + '+inauthor:' + author.replace(kindleVerStr, '').trim()
          }
        });

        asinArr[count] = item.productAsin;
        count++;
      } else {
        resultArr.push(
          createWishListItem(
            item.itemId,
            item.productPrice,
            item.productName,
            item.productAsin,
            item.authorName,
            item.imageUrl,
            item.amazonUrl,
            PRODUCT_ISBN_FLG.ok
          )
        );
      }
    });

    const axiosResults = await Promise.all(axiosArr);

    axiosResults.forEach((response, index) => {
      let asin = asinArr[index];
      let isbnFlg = PRODUCT_ISBN_FLG.ng;
      const item = itemList.find(element => element['productAsin'] == asin);

      if (Number(response.data.totalItems) >= 1) {
        for (let element of response.data.items[0].volumeInfo.industryIdentifiers) {
          if (element.type == 'ISBN_10') {
            asin = element.identifier;
            isbnFlg = PRODUCT_ISBN_FLG.ok;
            break;
          }
        }
      }

      resultArr.push(
        createWishListItem(
          item.itemId,
          item.productPrice,
          item.productName,
          asin,
          item.authorName,
          item.imageUrl,
          item.amazonUrl,
          isbnFlg
        )
      );
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
  return resultArr;
}


async function getLibraryInfo(itemList) {
  const productAsinArr = itemList.map((row) => {
    return [row['productAsin']];
  });

  let qStr = {
    appkey: config.calilappkey,
    isbn: productAsinArr.join(','),
    systemid: config.calilsystemid,
    format: 'json',
    callback: 'no'
  };

  const timeout = ms => new Promise(done => setTimeout(done, ms));
  let countinue = true;
  let items = {};
  while (countinue) {
    (async () => {
      await axios.get(CALIL_API_URL, {
        params: qStr
      })
        .then(function (response) {
          // handle success
          console.log('json.continue: %s', response.data.continue);
          if (response.data.continue == 0) {
            const books = response.data.books;
            items = Object.keys(books).map(function (isbn) {
              const item = itemList.find(element => element['productAsin'] == isbn);
              return createWishListItem(
                item.itemId,
                item.productPrice,
                item.productName,
                item.productAsin,
                item.authorName,
                item.imageUrl,
                item.amazonUrl,
                item.productIsbnFlg,
                books[isbn].Aichi_Kariya.reserveurl,
                books[isbn].Aichi_Kariya.libkey)
            });

            countinue = false;

          } else {
            // 再度API送信
            qStr = {
              appkey: config.calilappkey,
              session: response.data.session,
              format: 'json',
              callback: 'no'
            };
          }
        })
        .catch(function (error) {
          console.error(error);
          throw error;
        });
    })();
    await timeout(5000);
  }
  return items;
}

const createWishListItem = (itemId,
  productPrice,
  productName,
  productAsin,
  authorName,
  imageUrl,
  amazonUrl,
  productIsbnFlg = PRODUCT_ISBN_FLG.ng,
  reserveurl = '',
  libkey = {}) => {
  return {
    itemId: itemId,
    productPrice: productPrice,
    productName: productName,
    productAsin: productAsin,
    authorName: authorName,
    imageUrl: imageUrl,
    amazonUrl: amazonUrl,
    productIsbnFlg: productIsbnFlg,
    reserveurl: reserveurl,
    libkey: libkey
  }
}

exports.getAmazonWithList = getAmazonWithList;