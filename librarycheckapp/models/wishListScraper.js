const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { URL_BASE, IMAGE_URL, AMAZON_PRODUCT_URL, SELECTORS, ASIN } = require('../common/constants');

async function getItemList(wishListId) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
      const page = await browser.newPage();
      console.log('navigation to url %s', URL_BASE + wishListId);
      await page.goto(URL_BASE + wishListId);

      console.log('reloading page...');
      await page.reload({ waitUntil: 'networkidle0' });

      console.log('scrolling page to the end of page...');
      const { wishlistName, html } = await getProductsScrollingToTheEndOfPage(page);
      console.log('scroll finished');

      console.log('reading wishlist to get items...');
      const items = readWishlist({ html });

      console.log('closing browser...');
      await browser.close();

      return items;

    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      browser.close();
    }
  }

  async function getProductsScrollingToTheEndOfPage(page) {
    return await page.evaluate(async () => {
        const result = await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve(document);
                }
            }, 100);
        });

        return {
            wishlistName: result.querySelector('#profile-list-name').innerHTML,
            html: result.querySelector('#g-items').innerHTML
        };
    });
  }

  const readWishlist = ({ html }) => {
    const $ = cheerio.load(html);

    let items = $(SELECTORS.wishlistItemDiv).map(function () {
        const $element = $(this);
        const itemId = $element.attr()['data-itemid'];
        const productPrice = changeYen(parseFloat($element.attr()['data-price']));
        const productReposionJson = $element.attr()['data-reposition-action-params'];
        // 書籍の場合はISBNと同じ
        const asin = JSON.parse(productReposionJson).itemExternalId;
        const productAsin = asin.slice(ASIN.start, ASIN.end);

        const linkElement = $element.find(SELECTORS.wishlistItemName(itemId));
        const productName = linkElement.text().trim();

        const byLineElement = $element.find(SELECTORS.wishlistItemByLine(itemId));
        const authorName = byLineElement.text().trim();
        const imageUrl = IMAGE_URL(productAsin);
        const amazonUrl = AMAZON_PRODUCT_URL(productAsin);

        return {
            itemId, 
            productPrice, 
            productName, 
            productAsin,
            authorName,
            imageUrl,
            amazonUrl
        }
    }).get();

    return items;
};

function changeYen(num){
  return '¥' + String(num).split("").reverse().join("").match(/\d{1,3}/g).join(",").split("").reverse().join("");
}
  
exports.getItemList = getItemList;