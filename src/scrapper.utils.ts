import { defer, Observable, throwError, timer } from 'rxjs';
import { fromPromise } from 'rxjs/internal-compatibility';
import { finalize, mergeMap } from 'rxjs/operators';
import { Page } from 'puppeteer';

export const genericRetryStrategy = ({maxRetryAttempts = 3, scalingDuration = 1000, excludedStatusCodes = []}: {
    maxRetryAttempts?: number,
    scalingDuration?: number,
    excludedStatusCodes?: number[]
} = {}) => (attempts: Observable<any>) => {
    return attempts.pipe(
        mergeMap((error, i) => {
            const retryAttempt = i + 1;
            // if maximum number of retries have been met
            // or response is a status code we don't wish to retry, throw error
            if (
                retryAttempt > maxRetryAttempts ||
                excludedStatusCodes.find(e => e === error.status)
            ) {
                return throwError(error);
            }
            console.log(
                `Attempt ${retryAttempt}: retrying in ${retryAttempt *
                scalingDuration}ms`
            );
            // retry after 1s, 2s, etc...
            return timer(retryAttempt * scalingDuration);
        }),
        finalize(() => console.log('We are done!'))
    );
};

export const retryStrategyByCondition = ({maxRetryAttempts = 3, scalingDuration = 1000, retryConditionFn = (error) => true}: {
    maxRetryAttempts?: number,
    scalingDuration?: number,
    retryConditionFn?: (error) => boolean
} = {}) => (attempts: Observable<any>) => {
    return attempts.pipe(
        mergeMap((error, i) => {
            const retryAttempt = i + 1;
            if (
                retryAttempt > maxRetryAttempts ||
                !retryConditionFn(error)
            ) {
                return throwError(error);
            }
            console.log(
                `Attempt ${retryAttempt}: retrying in ${retryAttempt *
                scalingDuration}ms`
            );
            // retry after 1s, 2s, etc...
            return timer(retryAttempt * scalingDuration);
        }),
        finalize(() => console.log('retryStrategyOnlySpecificErrors - finalized'))
    );
};

export function getPageLocationOperator(page: Page): Observable<string> {
    return defer(() => fromPromise(page.evaluate((sel) => location.href)));
}
