import { concat, defer, EMPTY, Observable, of, throwError } from 'rxjs';
import { fromPromise } from 'rxjs/internal-compatibility';
import { catchError, concatMap, expand, map, retryWhen, switchMap, take, tap } from 'rxjs/operators';
import { Browser, Page } from 'puppeteer';
import { JobInterface, SalaryCurrency } from './models';
import { genericRetryStrategy, getPageLocationOperator, retryStrategyByCondition } from './scraper.utils';
import { fromArray } from 'rxjs/internal/observable/fromArray';
import { searchParamsList, stacks } from './data';

export interface ScraperSearchParams {
    searchText: string;
    locationText: string;
    pageNumber: number;
}

export interface ScraperResult {
    jobs: JobInterface[];
    searchParams: ScraperSearchParams;
}

const urlQueryPage = (search: ScraperSearchParams) =>
    `https://linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${search.searchText}&start=${search.pageNumber * 25}${search.locationText ? '&location=' + search.locationText : ''}`


function getJobsFromLinkedinPage(page: Page): Observable<JobInterface[]> {
    return defer(() => fromPromise(page.evaluate((pageEvalData) => {
        const collection: HTMLCollection = document.body.children;
        const results: JobInterface[] = [];
        for (let i = 0; i < collection.length; i++) {
            try {
                const item = collection.item(i)!;
                const title = item.getElementsByClassName('base-search-card__title')[0].textContent!.trim();
                const imgSrc = item.getElementsByTagName('img')[0].getAttribute('data-delayed-url') || '';
                const remoteOk: boolean = !!title.match(/remote|No office location/gi);

                const url = (
                    (item.getElementsByClassName('base-card__full-link')[0] as HTMLLinkElement)
                    || (item.getElementsByClassName('base-search-card--link')[0] as HTMLLinkElement)
                ).href;

                const companyNameAndLinkContainer = item.getElementsByClassName('base-search-card__subtitle')[0];
                const companyUrl: string | undefined = companyNameAndLinkContainer?.getElementsByTagName('a')[0]?.href;
                const companyName = companyNameAndLinkContainer.textContent!.trim();
                const companyLocation = item.getElementsByClassName('job-search-card__location')[0].textContent!.trim();

                const toDate = (dateString: string) => {
                    const [year, month, day] = dateString.split('-')
                    return new Date(parseFloat(year), parseFloat(month) - 1, parseFloat(day)    )
                }

                const dateTime = (
                    item.getElementsByClassName('job-search-card__listdate')[0]
                    || item.getElementsByClassName('job-search-card__listdate--new')[0] // less than a day. TODO: Improve precision on this case.
                ).getAttribute('datetime');
                const postedDate = toDate(dateTime as string).toISOString();


                /**
                 * Calculate minimum and maximum salary
                 *
                 * Salary HTML example to parse:
                 * <span class="job-result-card__salary-info">$65,000.00 - $90,000.00</span>
                 */
                let currency: SalaryCurrency = ''
                let salaryMin = -1;
                let salaryMax = -1;

                const salaryCurrencyMap: any = {
                    ['€']: 'EUR',
                    ['$']: 'USD',
                    ['£']: 'GBP',
                }

                const salaryInfoElem = item.getElementsByClassName('job-search-card__salary-info')[0]
                if (salaryInfoElem) {
                    const salaryInfo: string = salaryInfoElem.textContent!.trim();
                    if (salaryInfo.startsWith('€') || salaryInfo.startsWith('$') || salaryInfo.startsWith('£')) {
                        const coinSymbol = salaryInfo.charAt(0);
                        currency = salaryCurrencyMap[coinSymbol] || coinSymbol;
                    }

                    const matches = salaryInfo.match(/([0-9]|,|\.)+/g)
                    if (matches && matches[0]) {
                        // values are in USA format, so we need to remove ALL the comas
                        salaryMin = parseFloat(matches[0].replace(/,/g, ''));
                    }
                    if (matches && matches[1]) {
                        // values are in USA format, so we need to remove ALL the comas
                        salaryMax = parseFloat(matches[1].replace(/,/g, ''));
                    }
                }

                // Calculate tags
                let stackRequired: string[] = [];
                title.split(' ').concat(url.split('-')).forEach(word => {
                    if (!!word) {
                        const wordLowerCase = word.toLowerCase();
                        if (pageEvalData.stacks.includes(wordLowerCase)) {
                            stackRequired.push(wordLowerCase)
                        }
                    }
                })
                // Define uniq function here. remember that page.evaluate executes inside the browser, so we cannot easily import outside functions form other contexts
                const uniq = (_array) => _array.filter((item, pos) => _array.indexOf(item) == pos);
                stackRequired = uniq(stackRequired)

                const result: JobInterface = {
                    id: item!.children[0].getAttribute('data-entity-urn') as string,
                    city: companyLocation,
                    url: url,
                    companyUrl: companyUrl || '',
                    img: imgSrc,
                    date: new Date().toISOString(),
                    postedDate: postedDate,
                    title: title,
                    company: companyName,
                    location: companyLocation,
                    salaryCurrency: currency,
                    salaryMax: salaryMax || -1,
                    salaryMin: salaryMin || -1,
                    countryCode: '',
                    countryText: '',
                    descriptionHtml: '',
                    remoteOk: remoteOk,
                    stackRequired: stackRequired
                };
                console.log('result', result);

                results.push(result);
            } catch (e) {
                console.error(`Something when wrong retrieving linkedin page item: ${i} on url: ${window.location}`, e.stack);
            }
        }
        return results;
    }, {stacks})) as Observable<JobInterface[]>)
}

function getJobDescription(page: Page, job: Pick<JobInterface, 'url'>): Observable<Pick<JobInterface, 'url' | 'descriptionHtml'>> {

    return defer(() => {
        console.log('goto', job.url);
        return defer(() => fromPromise(page.setExtraHTTPHeaders({'accept-language': 'en-US,en;q=0.9'})))
            .pipe(
                // https://pptr.dev/api/puppeteer.puppeteerlifecycleevent
                switchMap(() => defer(() => fromPromise(page.goto(job.url, {waitUntil: 'networkidle2'}))))
            );
    })
        .pipe(
            tap((response) => {
                const status = (response as any)?.status();
                console.log('RESPONSE STATUS', status);
                if (status === 429) {
                    throw Error('Status 429 (Too many requests)');
                }

            }),
            switchMap(() => getPageLocationOperator(page).pipe(tap((locationHref) => {
                console.log(`LocationHref: ${locationHref}`);
                if (locationHref.includes('linkedin.com/authwall')) {
                    console.log('AUTHWALL')
                    throw Error('Linkedin authwall href: ' + locationHref);
                }
            }))),
            catchError(error => {
                console.log('Error', error);
                return throwError(error);
            }),
            retryWhen(genericRetryStrategy({
                maxRetryAttempts: 4
            })),
            switchMap(() =>
                defer(() => fromPromise(page.evaluate((sel) => {
                    console.log(`location ${location.href}`);
                    const descriptionContainerClassName = 'show-more-less-html__markup';
                    const descriptionContainer = document.getElementsByClassName(descriptionContainerClassName)[0] as HTMLElement;
                    // console.log('innerHtml', descriptionContainer.innerHTML);
                    return descriptionContainer && descriptionContainer.innerHTML ? descriptionContainer.innerHTML : '';
                })))
            ),
            map((descriptionHtml) => {
                // console.log('descriptionHtml', descriptionHtml);
                return {
                    ...job,
                    descriptionHtml
                }
            }),
            catchError((error) => {
                console.log('Linkedin getJobDescription Error', error);
                return of({...job, descriptionHtml: ''});
            })
        );


}


const cookies = [
    {
        'name': 'lang',
        'value': 'v=2&lang=en-us'
    }
];

const AUTHWALL_PATH = 'linkedin.com/authwall';
const STATUS_TOO_MANY_REQUESTS = 429;
const JOB_SEARCH_SELECTOR = '.job-search-card';

function goToLinkedinJobsPageAndExtractJobs(page: Page, searchParams: ScraperSearchParams): Observable<JobInterface[]> {
    return defer(() => fromPromise(page.setExtraHTTPHeaders({'accept-language': 'en-US,en;q=0.9'})))
        .pipe(
            switchMap(() => navigateToLinkedinJobsPage(page, searchParams)),
            tap(response => checkResponseStatus(response)),
            switchMap(() => throwErrorIfAuthwall(page)),
            switchMap(() => waitForJobSearchCard(page)),
            switchMap(() => getJobsFromLinkedinPage(page)),
            retryWhen(retryStrategyByCondition({
                maxRetryAttempts: 4,
                retryConditionFn: error => error.retry === true
            })),
            map(jobs =>  Array.isArray(jobs) ? jobs : []),
            take(1)
        );
}

/**
 * Navigate to the LinkedIn search page, using the provided search parameters.
 */
function navigateToLinkedinJobsPage(page: Page, searchParams: ScraperSearchParams) {
    return defer(() => fromPromise(page.goto(urlQueryPage(searchParams), {waitUntil: 'networkidle0'})));
}

/**
 * Check the HTTP response status and throw an error if too many requests have been made.
 */
function checkResponseStatus(response: any) {
    const status = response?.status();
    if (status === STATUS_TOO_MANY_REQUESTS) {
        throw {message: 'Status 429 (Too many requests)', retry: true, status: STATUS_TOO_MANY_REQUESTS};
    }
}

/**
 * Check if the current page is an authwall and throw an error if it is.
 */
function throwErrorIfAuthwall(page: Page) {
    return getPageLocationOperator(page).pipe(tap(locationHref => {
        if (locationHref.includes(AUTHWALL_PATH)) {
            console.error('Authwall error');
            throw {message: `Linkedin authwall! locationHref: ${locationHref}`, retry: true};
        }
    }));
}

/**
 * Wait for the job search card to be visible on the page, and handle timeouts or authwalls.
 */
function waitForJobSearchCard(page: Page) {
    return defer(() => fromPromise(page.waitForSelector(JOB_SEARCH_SELECTOR, {visible: true, timeout: 5000}))).pipe(
        catchError(error => throwErrorIfAuthwall(page).pipe(tap(() => {throw error})))
    );
}

function getJobsFromAllPages(page: Page, initSearchParams: ScraperSearchParams): Observable<ScraperResult> {
    const getJobs$ = (searchParams: ScraperSearchParams) => goToLinkedinJobsPageAndExtractJobs(page, searchParams).pipe(
        map((jobs): ScraperResult => ({jobs, searchParams} as ScraperResult)),
        catchError(error => {
            console.error(error);
            return of({jobs: [], searchParams: searchParams})
        })
    );

    return getJobs$(initSearchParams).pipe(
        expand(({jobs, searchParams}) => {
            console.log(`Linkedin - Query: ${searchParams.searchText}, Location: ${searchParams.locationText}, Page: ${searchParams.pageNumber}, nJobs: ${jobs.length}, url: ${urlQueryPage(searchParams)}`);
            if (jobs.length === 0) {
                return EMPTY;
            } else {
                return getJobs$({...searchParams, pageNumber: searchParams.pageNumber + 1});
            }
        })
    );
}

/**
 * Creates a new page and scrapes LinkedIn job data for each pair of searchText and locationText, recursively retrieving data until there are no more pages.
 * @param browser A Puppeteer instance
 * @returns An Observable that emits scraped job data as ScraperResult
 */
export function getJobsFromLinkedin(browser: Browser): Observable<ScraperResult> {
    // Create a new page
    const createPage = defer(() => fromPromise(browser.newPage()));

    // Iterate through search parameters and scrape jobs
    const scrapeJobs = (page: Page): Observable<ScraperResult> =>
        fromArray(searchParamsList).pipe(
            concatMap(({ searchText, locationText }) =>
                getJobsFromAllPages(page, { searchText, locationText, pageNumber: 0 })
            )
        )

    // Compose sequentially previous steps
    return createPage.pipe(switchMap(page => scrapeJobs(page)));
}
