const puppeteer = require('puppeteer')
const moment = require('moment')


const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const config = {
    login: 'grigorchuk.konstantin@gmail.com',
    pass: 'qrg7t8rhqy',

    certTimeBeforeExpire: 22 * DAY,
}

;(async () => {
    const browser = await puppeteer.launch()
    // const browser = await puppeteer.launch({
    //     headless: false,
    //     devtools: true,
    //     // slowMo: 250, // slow down by 250ms
    // })

    try {
        const page = await browser.newPage()

        // Translate browser console to master script
        page.on('console', msg => console.log('PAGE LOG:', msg.text()))

        await authorise(page)

        const certToRenew = await getOutdatedCertList(page)

        console.log(certToRenew)

        // await page.screenshot({ path: 'ya.png' })
    } catch (e) {
        console.error(e)
    }

    await browser.close()

    console.log('Done')
})()

async function authorise(page) {
    try {
        await page.goto('https://www.sslforfree.com/login')

        await page.evaluate((login, pass) => {
            document.querySelector('[name="email"]').value = login
            document.querySelector('[name="password"]').value = pass
        }, config.login, config.pass)

        return await Promise.all([
            page.waitForNavigation(),
            page.waitForResponse('https://www.sslforfree.com/a/'),
            page.click(`button[onclick="this.form.elements.a.value='login'"]`),
        ])
    } catch (e) {
        throw new Error('["authorise" script] ' + e.stack)
    }
}

async function getOutdatedCertList(page) {
    try {
        await page.goto('https://www.sslforfree.com/certificates')

        let data = await page.evaluate(() => {
            const trElList = [...document.querySelectorAll('#content_certificates table tbody tr')]
                .filter(tr => tr.querySelector('a[href]'))

            return trElList.reduce((out, tr) => {
                let [nameTd, createdTd, expiresTd, actionsTd] = [...tr.querySelectorAll('td')]

                const actions = [...actionsTd.querySelectorAll('a')].reduce((out, aEl) => {
                    out[aEl.textContent.toLowerCase()] = {
                        href: aEl.getAttribute('href'),
                        onclick: aEl.getAttribute('onclick'),
                    }

                    return out
                }, {})

                out.push({
                    name: nameTd.textContent,
                    created: createdTd.textContent,
                    expires: expiresTd.textContent,
                    actions,
                })

                return out
            }, [])
        })

        data = data
            .map(certInfo => {
                return ({
                    name: certInfo.name,
                    created: +moment(certInfo.created, 'MMMM Do YYYY'),
                    expires: +moment(certInfo.expires, 'MMMM Do YYYY'),
                    actions: certInfo.actions,
                })
            })
            .filter(({ expires }) => (Date.now() + config.certTimeBeforeExpire) > expires)

        return data
    } catch (e) {
        throw new Error('["getOutdatedCertList" script] ' + e.stack)
    }
}
