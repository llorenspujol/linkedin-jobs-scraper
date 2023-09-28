export const countries = [
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
export const technologies = [
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

export const countriesAndTechnologies: { tech: string; location: string }[] = countries.map((location) => {
    return technologies.map(tech => ({tech, location}))
}).flat();
