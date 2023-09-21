import * as path from 'path';
import * as fs from 'fs';
import * as puppeteer from 'puppeteer';
import { concatMap, map } from 'rxjs/operators';
import { defer, Subject } from 'rxjs';
import { fromArray } from 'rxjs/internal/observable/fromArray';
import { formatDate } from './utils';
import yargs from 'yargs';
import { getJobDataFromLinkedin } from './linkedin';
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

const countries = [
    '',
    'Spain',
    'France',
    'Germany',
    'Deutschland',
    'Belgium',
    'Italy',
    'United kingdom',
    'Scotland',
    'Ireland',

    'China',
    'India',
    'Japan',

    'United States',
    'Canada',

    'Denmark',
    'Norway',
    'Sweden',
    'Finland',

    'Russia',
    'Estonia',
    'Grece',
    'Romania',
    'Switzerland'
];


const technologies = [
    'Angular',
    'React',
    'Vue',
    'Javascript',
    'Typescript',
    'Python',
    'C++',
    'Django',
    'Ruby on rails',
    'Svelte',
    'Wordpress',
    'Ionic',
    'Solidity',
    'Laravel',
    'Stencil',
    'Frontend',
    'Backend',
    'Full stack',
    'Systems Engineer',
]


const countriesAndTechnologies: { tech: string; location: string }[] = countries.map((location) => {
    return technologies.map(tech => ({tech, location}))
}).flat();


(async () => {
    console.log('Launching Chrome...')
    const browser = await puppeteer.launch({
        headless: PUPPETEER_HEADLESS,
        // devtools: true,
        args: [

            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-first-run',
            '--no-sandbox',
            '--no-zygote',
            '--single-process',
        ],
        // devtools: true,
        // headless: false, // launch headful mode
        // slowMo: 250, // slow down puppeteer script so that it's easier to follow visually
    });

    const subject = new Subject();


    const page = await browser.newPage();

    /* Maybe init database */

    fromArray(countriesAndTechnologies).pipe(
        concatMap(({tech, location}) =>
            getJobDataFromLinkedin({searchText: tech, locationText: location}, page).pipe(
                concatMap(({jobs, searchParams, nPage}) => {
                    // Write jobs into files
                    const fileName = `linkedin_${searchParams.searchText}_${searchParams.locationText}_${nPage}.json`
                    const logJobDataFile: string = path.join(rootDirectory, jobsDataFolder, fileName);
                    return defer(() => fromPromise(fs.promises.writeFile(logJobDataFile, JSON.stringify(jobs, null, 2), 'utf-8'))).pipe(
                        map(() => ({jobs, searchParams, nPage}))
                    )
                })
            )
        )
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

    // START
    subject.next();

})();
