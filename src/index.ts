// ProNOTE Scraper
// Copyright (C) 2022  Mattéo T. and Contributors
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
// 
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import * as puppeteer from "puppeteer";

namespace ProNOTEScraper {
    // TODO: Add `done` property.
    export interface Homework {
        subject: string;
        task: string;
        attachments?: string[];
        // ISO format Date
        // JS: Date.prototype.toISOString();
        due: string;
    }

    // TODO: Add agenda
    // TODO: Add photo/name
    // TODO: Add scheduled events
    // TODO: Add grades
    // TODO: Add competences
    export interface UserData {
        homeworks: Homework[];
    }

    // TODO: Implement testing (might be hard to do without a ProNOTE license)
    // ! Browser should be reused! It's wasteful to create a new browser for every scrape.
    export async function fetchUserData(username: string, password: string, url: string, browser: puppeteer.Browser): Promise<UserData> {
        const page = await browser.newPage();

        // Wait for loading to complete
        await page.goto(url, {
            waitUntil: 'networkidle2'
        });

        // Type in credentials
        await page.type('input[type="text"]', username);
        await page.type('input[type="password"]', password);

        // Log in
        await page.click('button.themeBoutonConnexion')

        // Wait for login to succeed
        await page.waitForNavigation()

        // TODO: Check if login actually succeeded

        // Wait until the main page fully loads the assignments
        // TODO: Make this not dependent on language, currently only works in French
        await page.waitForSelector('header[title="Travaux à faire des 7 prochains jours"]');

        // Extract the data from inside the page by evaluating code
        const homeworks: Homework[] = await page.evaluate(async () => {
            // Initialize the array
            let hws: Homework[] = [];

            // Get the element that contains everything (date + assignments)
            const cdtListContainer = document.querySelector('div.conteneur-liste-CDT')!;

            // Iterate over the dates
            // conteneur-liste-CDT > liste-nested > li (days)[]
            // Can't iterate over an HTMLCollection but we can iterate through arrays
            // and arrays can be initialized from an HTMLCollection.
            for (const element of Array.from(cdtListContainer.children[0].children)) {
                // Date element is always the first element
                // and it is an h4 (HTMLHeadingElement)
                const dateElement = element.children[0] as HTMLHeadingElement;

                // Parse dateElement id as date
                // Example: id_94_date_2022_7_29 for 29th of August
                // Example: id_94_date_2022_8_1 for 1st of September
                // It will return an array, for example
                // [2022, 8, 1]
                const dateBeforeObject = dateElement.id.replace(/id_[0-9]{2}_date_/, '').split('_');

                // Create the JS Date object
                const date = new Date();
                date.setDate(parseInt(dateBeforeObject[2]));
                // We don't need to substract 1 as it is already substracted
                date.setMonth(parseInt(dateBeforeObject[1]));
                date.setFullYear(parseInt(dateBeforeObject[0]));

                // Iterate over every assignment
                // The assignments are under an unordered list as a child of the CDT list
                // li > ul > li liste-item
                for (const child of Array.from(element.children[1].children)) {
                    const itemContainer = child.children[0];

                    // Subject and task, I am using parentheses and `as HTMLSpanElement`/`as HTMLDivElement`
                    // to hint TS that the innerText property exists
                    // div > div > span
                    const subject = (itemContainer.children[0].children[0].children[0] as HTMLSpanElement).innerText;
                    // div > div > div
                    const task = (itemContainer.children[1].children[0].children[0] as HTMLDivElement).innerText.replaceAll('<br>', '');

                    // Check if homework has an attachment
                    // The attachment is a link and gets invalidated after a while
                    // TODO: Download/get URL for attachment before the invalidation inevitably happens
                    // Also a bad practice to distribute the URL, I don't know if a session is attached
                    // TODO: Implement multiple attachments
                    if (itemContainer.children[1].children.length > 1) {
                        // div > div > div > a
                        const attachment = (itemContainer.children[1].children[1].children[0].children[0] as HTMLAnchorElement).href;

                        // Push the attachment or without
                        // TODO: This is dumb, we should return an empty array if there are no attachments. Fix this.
                        hws.push({ subject, task, attachments: [attachment], due: date.toISOString() });
                    } else hws.push({ subject, task, due: date.toISOString() });
                }
            }

            return hws;
        });

        // Return the data
        return { homeworks };
    }
}

export default ProNOTEScraper;