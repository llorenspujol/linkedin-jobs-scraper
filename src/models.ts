export type SalaryCurrency = 'USD' | 'EUR' | 'GBP' | 'RON' | 'CHF' | '';

export interface JobInterface {
    _id?: any;
    id: string;
    title: string;
    img: string;
    url: string;
    companyUrl: string;
    date: string; // format: yyyy-mm-dd
    postedDate: Date | string;
    company: string;
    location: string;
    countryCode: string;
    countryText: string;
    descriptionHtml: string | undefined;
    city: string;
    remoteOk: boolean;
    salaryMin: number;
    salaryMax: number;
    salaryCurrency: SalaryCurrency;
    stackRequired: string[];
}
