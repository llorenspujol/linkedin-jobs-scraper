import * as puppeteer from 'puppeteer';
import * as chalk from 'chalk';

export function formatDate(date: Date | string | number) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) {
        month = '0' + month;
    }
    if (day.length < 2) {
        day = '0' + day;
    }

    return [year, month, day].join('-');
}

function describe(jsHandle) {
    return jsHandle.executionContext().evaluate(obj => {
        // serialize |obj| however you want

        return 'beautiful object of type ' + (typeof obj);
    }, jsHandle);
}


export function pageAddLogs(page: puppeteer.Page, pageId: string): void {
    /*
    See: https://github.com/puppeteer/puppeteer/issues/2083
    page.on('console', async msg => {
        const args = await Promise.all(msg.args().map(arg => describe(arg)));
        console.log(msg.text(), ...args);
      });
    */

    page.on('console', message => {
        if (message.type() === 'warning') {
            return;
        }
        const type = message.type().substr(0, 3).toUpperCase()
        const colors = {
            LOG: text => text,
            ERR: chalk.red,
            WAR: chalk.yellow,
            INF: chalk.cyan
        }
        const color = colors[type] || chalk.blue
        console.log(`${pageId}`, color(`${type} ${message.text()}`));
    })
        .on('pageerror', (error) => console.log(`${pageId} pageerror: `, error))
        // .on('response', response => console.log(`${pageId} response: ${response.status()} ${response.url()}`))
        // .on('request', request => console.log(`${pageId} request: ${request.url()} headers: ${JSON.stringify(request.headers())} response: ${request.response()}`))
        .on('requestfailed', request => console.log(`${pageId} requestfailed: ${request!.failure()!.errorText} ${request.url()}`))
}
