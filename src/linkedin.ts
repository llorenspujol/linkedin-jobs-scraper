import { concat, defer, EMPTY, Observable, of, throwError } from 'rxjs';
import { fromPromise } from 'rxjs/internal-compatibility';
import { catchError, delay, map, reduce, retryWhen, switchMap, take, tap } from 'rxjs/operators';
import { Page } from 'puppeteer';
import { JobInterface, SalaryCurrency } from './models';
import { genericRetryStrategy, getPageLocationOperator, retryStrategyByCondition } from './scrapper.utils';

export interface ScraperSearchParams {
    searchText: string;
    locationText?: string;
}

export interface ScraperResult {
    jobs: JobInterface[];
    searchParams: ScraperSearchParams;
    nPage: number;
}

export const urlQueryPage = (search: ScraperSearchParams, page: number) =>
    `https://linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${search.searchText}&start=${page * 25}${search.locationText ? '&location=' + search.locationText : ''}`


export function getJobsData(page: Page): Observable<JobInterface[]> {
    return defer(() => fromPromise(page.evaluate((sel) => {
        const collection: HTMLCollection = document.body.children;
        const results: JobInterface[] = [];
        for (let i = 0; i < collection.length; i++) {
            // if (!!collection.item(i)!.getAttribute('data-id')) {
            try {
                const item = collection.item(i)!;

                const title = item.getElementsByClassName('base-search-card__title')[0].textContent!.trim();

                const imgSrc = item.getElementsByTagName('img')[0].getAttribute('data-delayed-url') || '';
                const imgAlt = item.getElementsByTagName('img')[0].getAttribute('alt') || '';

                let salaryMin = -1;
                let salaryMax = -1;

                // TODO: Check for european remote
                const remoteOk: boolean = !!title.match(/remote|No office location/gi);

                const url = (
                    (item.getElementsByClassName('base-card__full-link')[0] as HTMLLinkElement)
                    || (item.getElementsByClassName('base-search-card--link')[0] as HTMLLinkElement)
                ).href;

                const companyNameAndLinkContainer = item.getElementsByClassName('base-search-card__subtitle')[0];
                const companyUrl: string | undefined = companyNameAndLinkContainer?.getElementsByTagName('a')[0]?.href;
                const companyName = companyNameAndLinkContainer.textContent!.trim();
                const companyLocation = item.getElementsByClassName('job-search-card__location')[0].textContent!.trim();

                const formatDate = (date: Date) => {
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

                const toDate = (dateStr) => {
                    const [year, month, day] = dateStr.split('-')
                    return new Date(year, month - 1, day)
                }

                // Datetime in format: 2021-03-20 -> yyyy-mm-dd
                const dateTime = (
                    item.getElementsByClassName('job-search-card__listdate')[0]
                    || item.getElementsByClassName('job-search-card__listdate--new')[0] // less than a day. TODO: Improve precision on this case.
                ).getAttribute('datetime');
                const postedDate = formatDate(toDate(dateTime));


                /**
                 * salary:
                 * <span class="job-result-card__salary-info">$65,000.00 - $90,000.00</span>
                 *
                 * '$65,000.00 - $90,000.00'.match(/([0-9]|,|\.)+/g)
                 */
                let currency: SalaryCurrency = ''

                const salaryCurrencyMap: any = {
                    ['€']: 'EUR',
                    ['$']: 'USD',
                    ['£']: 'GBP',
                }

                // TODO: revise salary info
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

                // IMPORTANT: Remember that we CANNOT import external files in a puppeteer eval function! just paste here for now...
                const stacksFromStackOverflow = ['angularjs', 'kubernetes', 'javascript', 'jenkins', 'html', 'angular-material-7', 'angular-material2', 'angular-material-5', 'angular', 'css', 'via', 'typescript2.0', 'angular8', 'java', 'spring', 'hibernate', 'typescript', 'go', 'amazon-web-services', 'mongodb', 'node.js', 'saas', 'jwt', 'rxjs', 'c#', 'android', 'ios', 'reactjs', 'continuous-integration', 'ionic-framework', 'webpack', 'highcharts', 'express', 'react-native', 'azure', 'scrum', '.net-core', 'architecture', 'rest', 'asp.net-core-webapi', 'ngrx', 'devops', 'angular-material', 'docker', 'graphql', 'php', 'restful', 'python', 'npm', 'user-interface', 'user-experience', 'frontend', 'asp.net-core', 'asp.net-mvc', 'mysql', '.net', 'redis', 'linux', 'wpf', 'xamarin', 'ruby-on-rails', 'sql', 'postgresql', 'git', 'project-management', 'neoscms', 'typo3', 'tomcat', 'mockito', 'swift', 'restapi', 'cybersecurity', 'core', 'vue.js', 'asp.net', 'angular-ui-bootstrap', 'electron', 'graph', 'spring-boot', 'elixir', 'phoenix', 'django', 'spring-boot-2', 'kotlin', 'terraform', 'flask', 'apache', 'aurelia', 'ecmascript-6', 'ruby', 'swift4', 'oracle', 'soa', 'java-ee-6', 'sass', 'html5', 'react', 'css3', 'jquery', 'microservices', 'webrtc', 'swagger', 'sql-server', 'winforms', 'node', 'single-page-application', 'progressive-web-apps', 'websocket', 'logo-lang', 'tailwind-css', 'tdd', 'security', 'cloud', 'sapui5', 'odata', 'frameworks', 'mobile', 'nestjs', 'google-cloud-platform', 'nosql', 'bootstrap-4', 'wordpress', 'design-patterns', 'vue', 'aws', 'github', 'startup', 'java-ee', 'jira', 'intellij-idea', 'agile', 'c#.net', 'web-services', 'linq', 'c', 'azure-sql-database', 'cordova', 'maven', 'jakarta-ee', 'aws-iot', 'junit', 'data', 'jpa', 'database', 'event-driven', 'apache-kafka', 'elasticsearch', 'json', 'automation', 'aws-eks', 'ansible', 'open-source', 'rest-assured', 'protractor', 'golang', 'symfony4', 'design', 'unit-testing', 'mobx', 'vue-component', 'vuex', 'vuetify.js', 'jestjs', 'oop', 'redux', 'web', 'postman', 'cypress', 'spartacus-storefront', 'testing', 'robotframework', 'gitlab', 'backend', 'ember.js', 'shell', 'c++builder', 'c++', 'iot', 'r', 'laravel', 'selenium', 'cucumber', 'api-design', 'windows', 'webgl', 'azure-devops', 'word', 'continuous-delivery', 'qa', 'specflow', 'drupal8', 'styled-components', 'playframework', 'react-redux', 'd3.js', 'perl', 'sailpoint', 'blockchain', 'contentful', 'apollo', 'python-3.x', 'redux-saga', 'react-hooks', 'mobile-development', 'sdk', 'http', 'next.js', 'symfony', 'react-state-management', 'symfony2', 'google-cloud', 'platform', 'high-traffic', 'bigdata', 'react-fullstack', 'web-applications', 'relayjs', 'hugo', 'network-security', 'bash', 'database-management', 'sysadmin', 'jboss', 'wildfly', 'jdbc', 'data-warehouse', 'etl', 'jvm', 'react-query', 'haskell', 'purescript', 'apache-kafka-streams', 'machine-learning', 'artificial-intelligence', 'material-ui', 'react-final-form', 'node-js', 'api', 'crypto', 'extjs', 'reactnative', 'next', 'ssr', 'three.js', 'unreal-engine4', 'opengl', 'seo', 'functional-programming', 'solidity', 'hazelcast', 'grafana', 'kibana', 'clojure', 'clojurescript', 're-frame', 'apache-spark', 'couchdb', 'rust', 'amazon-redshift', 'grpc', 'grpc-go', 'responsive-design', 'prose-mirror', 'real-time', 'vagrant', 'graphene-python', 'prometheus', 'ui', 'ux', 'nodejs', 'micro-frontend', 'content-management-system', 'drupal', 'entity-framework', 'distributed-system', 'intellij-13', 'scala', 'flutter', 'java-11', 'headless-cms', 'genesys', 'genesys-platform-sdk', 'postgres', 'google-app-engine', 'mlops', 'mern', 'figma', 'groovy', 'google-maps', 'data-visualization', 'boost', 'audio', 'invision', 'appium', 'circleci', 'gradle', 'gatsby', 'jsp', 'react.js', 'deployment', 'communication', 'jasmine', 'matlab', 'solid-principles', 'server-side-rendering', 'serverless', 'tensorflow', 'svelte', 'grails', 'lumen', 'vert.x', 'continuous-deployment', 'objective-c', 'hardware-interface', 'c#-4.0', 'apex', 'salesforce', 'lucene', 'aws-cdk', 'lambda', 'amazon-s3', 'amazon-rds', 'spring-mvc', 'gcp', 'boot', 'automated-tests', 'less', 'parceljs', 'mqtt', 'sws', 'product', 'mercurial', 'phpunit', 'css-preprocessor', 'firebase', 'google-cloud-functions', 'bdd', 'akka', 'scala-cats', 'java-8', 'protocol-buffers', 'vuejs', 'babeljs', 'serverless-framework', 'parse-platform', 'dry', 'solid', 'thymeleaf', 'sentry', 'slim', 'azure-functions', 'aws-api-gateway', 'amazon-dynamodb', 'rabbitmq', 'model-view-controller', 'gpt', 'aws-lambda', 'excel', 'c++11', 'macos', 'stream-processing', 'lamp', 'jenkins-pipeline', 'webdriver', 'nunit', 'chromium', 'statistics', 'mariadb', 'web-animations', 'dom', 'xaml', 'lua', 'reverse-engineering', 'neural-network', 'prediction', 'openstack', 'android-studio', 'golang-migrate', 'asp.net-web-api', 'xamarin.forms', 'data-pipeline', 'woocommerce', 'sidekiq', 'postcss', 'pyramid', 'restify', 'erlang', '3d', 'rendering', 'salesforce-commerce-cloud', 'payment', 'reliability', 'salesforce-communities', 'cassandra', 'pytorch', 'containers', 'ethereum', 'cryptocurrency', 'rdbms', 'shopify', 'shopware', 'multithreading', 'network-programming', 'networking', 'cryptography', 'p2p', 'lead', 'mvvm', 'behat', 'vb.net', 'rpa', 'uml', 'qt', 'web-development-server', 'php-7', 'magento', 'magento2', 'express.js', 'sre', 'powershell', 'product-management', 'owasp', 'openid-connect', 'penetration-testing', 'oauth-2.0', 'applitools', 'galen', 'puppet', 'qml', 'dart', 'swiftui', 'uikit', 'appium-android', 'appium-ios', 'hana', 'abap', 'maps', 'gis', 'lorawan', 'node-red', 'data-science', 'doctrine', 'cloudformation', 'dynamics-crm', 'dynamics-crm-365', 'power-automate', 'nginx', 'ms-access', 'hmtl', 'rest-api', 'cdn', 'newrelic', 'mssql', 'crm', 'back-end', 'salt-stack', 'infrastructure-as-code', 'sphinx', 'google-apps-script', 'google-gsuite', 'liquid', 'sap', 'end-to-end', 'wicket', 'shadow-dom', 'elm', 'pixi.js', 'domain-driven-design', 'cdk', 'html5-canvas', 'codeceptjs', 'performance-testing', 'web-api-testing', 'unix', 'authentication', 'oauth', 'fastapi', 'pyspark', 'hadoop', 'algorithm', 'geospatial', 'postgis', 'elk', 'dvc', 'command-line-interface', 'pandas', 'hl7-fhir', 'scipy', 'kafka', 'airflow', 'numpy', 'conda', 'scikit-learn', 'infrastructure', 'walrus-operator', 'qgraphicsview', 'pyqtgraph', 'python-asyncio', 'jupyter-notebook', 'lte', 'computer-vision', 'sqlalchemy', 'c++14', 'apache-flink', 'luigi', 'database-administration', 'embedded', 'embedded-linux', 'ubuntu', 'banking', 'scripting', 'message-queue', 'google-bigquery', 'julia', 'paas', 'dbt', 'video', 'distributed-computing', 'amazon-cloudformation', 'perforce', 'keras', 'gitlab-ci', 'apache-airflow', 'relational-database', 'informatica', 'computer-architecture', 'deep-learning', 'dask', 'cluster-computing', 'ceph', 'cephfs', 'cmake', 'bioinformatics', 'netbeans', 'data-analysis', 'rspec', 'kanban', 'linux-kernel', 'event-driven-design', 'rpm', 'architect', 'cpu', 'cpu-architecture', 'gpu', 'lxc', 'fortran', 'tsql', 'network-protocols', 'can-bus', 'battery', 'elastic-stack', 'stochastic-process', 'graph-theory', 'qnx', 'hdfs', 'configuration', 'data-modeling', 'netweaver', 'apache-pulsar', 'google-anthos', 'qlikview', 'server', 'metabase', 'redash', 'business-intelligence', 'web-scraping', 'data-mining', 'debugging', 'cross-platform', 'xml', 'xslt-2.0', 'databricks', 'kvm', 'gnu', 'tcp-ip', 'hive', 'feature-engineering', 'big-data', 'centos', 'redshift', 'slam', 'visual-odometry', 'kubernetes-helm', 'nlp', 'forecasting', 'amazon-athena', 'c++17', 'simulink', 'freertos', 'infrastructure-as-a-code', 'unity3d', 'android-espresso', 'opencv', 'datadog', 'spark-streaming', 'system-administration', 'google-kubernetes-engine', 'kubernetes-ingress', 'looker', 'chef-infra', 'pytest', 'powerbi', 'confluence', 'malware-detection', 'low-latency', 'osx', 'yocto', 'debian', 'yaml', 'tableau-api', 'video-streaming', 'clickhouse', 'abas', 'nextflow', 'shiny', 'sparql', 'system', 'c-sharp', 'windows-applications', 'cocoa', 'method-swizzling', 'arinc', 'systems-programming', 'altium-designer', 'blazor', 'opc', 'ethernet', 'posix', 'verilog', 'scada', 'industrial', 'htl', 'ata', 'mvc', 'data-structures', 'rx-java', 'concurrency', 'solr', 'oo-design', 'orm', 'jailbreak', 'vpn', 'socket', 'augmented-reality', 'trading', 'forex', 'plsql', 'appkit', 'core-data', 'software-design', 'server-administration', 'itil', 'physics', 'quantmod', 'custom-error-handling', 'unity', 'vb', 'optimization', 'graphics', 'functional', 'couchbase', 'azure-cosmosdb', 'moltenvk', 'vulkan', 'sling', 'osgi', 'aem', 'webapi', 'mumps', 'amazon-kinesis', 'data-distribution-service', 'android-source', 'desktop-application', 'use-case', 'bpmn', 'cobra', 'requirements-management', 'tfs', 'enterprise-architect', 'sbt', 'swift5', 'integration-testing', 'aws-codebuild', 'dhcp', 'dns', 'cd', 'supervisord', 'fabric', 'gdprconsentform', 'audit', 'sox', 'android-camera', 'xcuitest', 'e-commerce', 'heroku', 'elixir-iex', 'sinatra', 'caching', 'solidus', 'xcode', 'rust-tokio', 'phoenix-framework', 'webxr', 'html5-video', 'babylonjs', 'rtmp', 'laravel-5.7', 'laravel-5.8', 'visual-studio-code', 'jsf', 'usability', 'primefaces', 'flux', 'iphone', 'bitrise', 'fastlane', 'ios-autolayout', 'profiling', 'view-debugging', 'android-jetpack', 'kotlin-coroutines', 'teamcity', 'android-viewbinding', 'exoplayer', 'design-system', 'material-design', 'watchkit', 'rx-kotlin', 'xib', 'cocoa-touch', 'refactoring', 'sustainable-pace', 's4hana', 'sapr3', 'openshift', 'hubspot', 'akka-stream', 'sketchapp', 'hybris', 'project-reactor', 'combine', 'erp', 'soap', 'java-ee-8', 'recommendation-engine', 'ab-testing', 'typeorm', 'sap-fiori', 'wear-os', 'neo4j', 'aws-elemental', 'serverless-architecture', 'laminas', 'kafka-consumer-api', 'docker-swarm', 'cobol', 'clang', 'laravel-nova', 'codeigniter', 'zio', 'cats-effect', 'f#', 'sip', 'tls1.2', 'interface', 'testng', 'xsd', 'bison', 'tokenize', 'eclipse', 'stl', 'single-sign-on', 'mocha.js', 'chai', 'analytics', 'gherkin', 'integration', 'apache-beam', 'spotify-scio', 'vmware', 'switching', 'coreml', 'analysis', 'gwt', 'tooling', 'observability', 'tcpip', 'lan', 'wan', 'iaas', 'vlan', 'voip', 'red', 'redhat', 'hpc', 'slurm', 'admin', 'controlling', 'computer-science', 'hyper-v', 'windows-client', 'solaris', 'exadata', 'proxysql', 'database-design', 'query-optimization', 'impala', 'flink', 'active-directory', 'exchange-server', 'pulumi', 'telecommunication', 'penetration-tools', 'honeypot', 'verification', 'kpi', 'system-testing', 'manual-testing', 'arm', 'electronics', 'zynq', 'fpga', 'x-ray', 'dynamics-365', 'dynamics-ax-2012', 'microsoft-dynamics', 'nav', 'archive', 'ip', 'io', 'page-caching', 'enterprise', 'ptc-windchill', 'thingworx',
                    'ms-office', 'google-workspace', 'jooq', 'amazon-sagemaker', 'gin-gonic', 'llvm', 'compiler-construction', 'sketch', 'military', 'office365', 'aps', 'discrete-optimization', 'ada', 'cosmos', 'azure-active-directory', 'cad', 'teamleader', 'photogrammetry', 'image-processing', 'distributed', 'mapreduce', 'scale', 'argocd', 'liferay', 'product-development', 'rxjava', 'dagger2', 'sqlite', 'sap-commerce-cloud', 'spark', 'package', 'module', 'quarkus', 'keycloak', 'ssas', 'ssis', 'bigtable', 'jruby', 'oxid', 'math', 'performance', 'api-gateway', 'hashicorp', 'pentaho', 'bamboo', 'puppet-enterprise', 'buildmaster', 'visual-studio', 'prototype', 'karate', 'software-quality', 'silktest', 'prototyping', 'mixpanel', 'ssrs', 'cloud-platform', 'agile-project-management', 'migration', 'documentation', 'ads', 'advertisement-server', 'ssp', 'build', 'memcached', 'spring-kafka', 'self-contained', 'virtualization', 'visualization', 'cisco', 'storage', 'san', 'ibm-integration-bus', 'rpg', 'azure-logic-apps', 'cds'];


                let tags: string[] = [];

                title.split(' ').concat(url.split('-')).forEach(word => {
                    if (!!word) {
                        const wordLowerCase = word.toLowerCase();
                        if (stacksFromStackOverflow.includes(wordLowerCase)) {
                            tags.push(wordLowerCase)
                        }
                    }
                })

                const uniq = (_array) => _array.filter((item, pos) => _array.indexOf(item) == pos);
                tags = uniq(tags)

                const result: JobInterface = {
                    id: item!.children[0].getAttribute('data-entity-urn') as string,
                    city: companyLocation,
                    url: url,
                    companyUrl: companyUrl || '',
                    img: imgSrc,
                    date: formatDate(new Date()),
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
                    stackRequired: tags
                };
                console.log('result', result);

                results.push(result);
            } catch (e) {
                console.error(`Something when wrong retrieving linkedin page item: ${i} on url: ${window.location}`, e.stack);
            }
        }
        return results;
    })) as Observable<JobInterface[]>)
}

export function getJobDescription(page: Page, job: Pick<JobInterface, 'url'>): Observable<Pick<JobInterface, 'url' | 'descriptionHtml'>> {

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

function getJobsFromCityAndPage(page: Page, searchParams: ScraperSearchParams, nPage: number): Observable<JobInterface[]> {
    return defer(() => fromPromise(page.setExtraHTTPHeaders({'accept-language': 'en-US,en;q=0.9'}))).pipe(
        switchMap(() => defer(() => fromPromise(page.goto(urlQueryPage(searchParams, nPage), {waitUntil: 'networkidle0'}))))
    ).pipe(
        tap((response) => {
            const status = (response as any)?.status();
            // console.log('RESPONSE STATUS', status);
            if (status === 429) {
                throw {message: 'Status 429 (Too many requests)', retry: true, status: 429};
            }

        }),
        /*switchMap(() => getPageLocationOperator(page).pipe(tap((locationHref) => {
            if (locationHref.includes('linkedin.com/authwall')) {
                throw {message: `Linkedin authwall! locationHref: ${locationHref}`, retry: true};
            }
        }))),*/

        // Set lang english for obtain always the same result text for parsing.
        switchMap(() => defer(() => fromPromise(page.waitForSelector('.job-search-card', {visible: true, timeout: 5000}))).pipe( // defer(() => fromPromise(page.setCookie(...cookies)))
            catchError(error => {
                return getPageLocationOperator(page).pipe(map((locationHref) => {
                    if (locationHref.includes('linkedin.com/authwall')) {
                        console.log('AUTHWALL error!!!')
                        throw {message: `Linkedin authwall! locationHref: ${locationHref}`, retry: true};
                    }
                    return [];
                })); // throwError({message: 'Linkedin - waitForSelector timeout', retry: false});
            }),
            switchMap(() => getJobsData(page)),
            catchError(error => {
                if (error.retry) {
                    return throwError(error);
                }
                return of([]); // throwError({message: 'Linkedin - waitForSelector timeout', retry: false});
            }),
            /*switchMap((jobs: JobInterface[]) => concat(...jobs.map(job => getJobDescription(page, job))).pipe(
                delay(2000), // TODO: this should be not constant, instead it should define the minimum time interval between jetJobDescription
                reduce((acc, cur, index) => {
                    console.log(`index: ${index}, description:`);
                    return [...acc, cur]
                }, [])
            ))*/
        )),
        retryWhen(retryStrategyByCondition({
            maxRetryAttempts: 4,
            retryConditionFn: (error) => error.retry === true
        })),
        map((jobs: JobInterface[]) => Array.isArray(jobs) ? jobs : []),
        take(1)
    );
}

export function getJobDataFromLinkedin(searchParams: ScraperSearchParams, page: Page): Observable<ScraperResult> {
    return new Observable<ScraperResult>((observer) => {

        const getJobsFromPageRecursive = (nPage: number): Observable<ScraperResult> => {
            return getJobsFromCityAndPage(page, searchParams, nPage).pipe(
                map((jobs): ScraperResult => ({jobs, searchParams, nPage} as ScraperResult)),
                catchError(error => {
                    console.error('error', error);
                    return of({jobs: [], searchParams, nPage})
                }),
                switchMap(({jobs}) => {
                    console.log(`Linkedin - Query: ${searchParams.searchText}, Location: ${searchParams.locationText}, Page: ${nPage}, nJobs: ${jobs.length}, url: ${urlQueryPage(searchParams, nPage)}`);
                    observer.next({jobs, searchParams, nPage});
                    if (jobs.length === 0) {
                        return EMPTY;
                    } else {
                        nPage++;
                        return getJobsFromPageRecursive(nPage);
                    }
                })
            );
        }

        const subscription = getJobsFromPageRecursive(0).subscribe(observer);

        return () => subscription.unsubscribe();
    })
}
