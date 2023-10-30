# LinkedIn Jobs Scraper

LinkedIn Jobs Scraper running in Node.js that uses Puppeteer and RxJS to scrape job offers from LinkedIn.

![Example video scraping linkedin job offers](/assets/video-showcase.gif)

> IMPORTANT: Web scraping can frequently violate the terms of service of a website. Always review and respect a website's robots.txt file and its Terms of Service. In this instance, this code should be used ONLY for teaching and hobby purposes. LinkedIn specifically prohibits any data extraction from its website; you can read more here: https://www.linkedin.com/legal/crawling-terms.

## Highlights
- 🔧 Parses LinkedIn job offers and returns the data in JSON format
- 📄 Loops through all the pages for a specified search params
- 🔁 Loops through as many search params as needed.
- ⚡️ Uses RxJS Observables instead of Promises
- 🛑 Handles 429 status code error
- 🛡 Handles Linkedin Authwall
- 💾 Saves the scraped data as JSON in an auto-generated `/data` folder
- 📝 It is written entirely in Typescript.

## How this code works
I wrote a blog explaining the code written in this repo with all the steps involved. You can find it [here](https://gironajs.com/en/blog/web-scraping-linkedin-jobs-using-puppeteer-and-rxjs)

### Quick start
**Node version >= 12 and NPM >= 6**

```bash
# clone the repo.
git clone https://github.com/your-username/linkedin-jobs-scraper.git

# go to the repo
cd linkedin-jobs-scraper

# install the dependencies via npm
npm install

# start scraping
npm run start
```

### NPM scripts

* `npm run start` - runs with puppeteer in headless mode.
* `npm run start:debug` - runs with puppeteer in non-headless mode.
* `npm run clean:data` - removes the folder `/data`


