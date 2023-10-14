# LinkedIn Jobs Scraper

LinkedIn Jobs Scraper is a Node.js project that uses Puppeteer and RxJS to retrieve job listings from LinkedIn web pages.

> IMPORTANT: Web scraping can frequently violate the terms of service of a website. Always review and respect a website's robots.txt file and its Terms of Service. In this instance, this code should be used ONLY for teaching and hobby purposes. LinkedIn specifically prohibits any data extraction from its website; you can read more here: https://www.linkedin.com/legal/crawling-terms.

## Features

- Retrieves job listings from LinkedIn web pages.
- Supports any list of search parameters with searchText and locationText.
- Utilizes Puppeteer.
- Utilizes RxJS Observables for improved composition and enhanced error handling.
- Saves the scraped data as JSON in an auto-generated `/data` folder

## Installation

Make sure you have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) (Node Package Manager) installed on your system.

1. Clone this repository:

   ```bash
   git clone https://github.com/your-username/linkedin-jobs-scraper.git
   ```

2. Change to the project directory:

   ```bash
   cd linkedin-jobs-scraper
   ```

3. Install project dependencies:

   ```bash
   npm install
   ```

4. Run:

   ```bash
   npm run start
   ```
   
5. Run Debug (non-headless):

   ```bash
   npm run start:debug
   ```

