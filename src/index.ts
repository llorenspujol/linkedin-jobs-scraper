import * as path from 'path';
import * as fs from 'fs';
import * as puppeteer from 'puppeteer';
import { concatMap, map } from 'rxjs/operators';
import { defer } from 'rxjs';
import { formatDate } from './utils';
import yargs from 'yargs';
import { getJobsFromLinkedin } from './linkedin';
import { fromPromise } from 'rxjs/internal-compatibility';


const argv = yargs(process.argv)
    .option('headless', {
        alias: 'hdl',
        type: 'boolean',
        description: 'Whether or not execute puppeteer in headless mode. Defaults to true'
    })
    .argv;

const PUPPETEER_HEADLESS = argv.headless ?? true;

const todayDate = formatDate(new Date());

console.log('Today date: ', todayDate);

// Read scrapper file to check if there is a previous state
const jobsDataFolder: string = `data`;
const rootDirectory = path.resolve(__dirname, '..');

// Make log directory if there isn't
fs.mkdirSync(path.join(rootDirectory, jobsDataFolder), {recursive: true});

(async () => {
    console.log('Launching Chrome...')
    const browser = await puppeteer.launch({
        headless: PUPPETEER_HEADLESS,
        // devtools: true,
        // slowMo: 250, // slow down puppeteer script so that it's easier to follow visually
        args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-first-run',
            '--no-sandbox',
            '--no-zygote',
            '--single-process',
        ],
    });


    getJobsFromLinkedin(browser).pipe(
        concatMap(({jobs, searchParams}) => {
            // Normally here you would save the jobs to a database, in this example just write the jobs in a json file.
            const fileName = `linkedin_${searchParams.searchText}_${searchParams.locationText}_${searchParams.pageNumber}.json`
            const logJobDataFile: string = path.join(rootDirectory, jobsDataFolder, fileName);
            return defer(() => fromPromise(fs.promises.writeFile(logJobDataFile, JSON.stringify(jobs, null, 2), 'utf-8'))).pipe(
                map(() => ({jobs, searchParams}))
            )
        })
    ).subscribe(() => {}, (error) => {
        console.log('Major error, closing browser...', error);
        browser.close();
        process.exit();
    }, () => {
        console.log('FINISHED');
        browser.close();

        setTimeout(() => {
            console.log('PROCESS EXIT');
            process.exit();
        }, 0);
    });

})();
