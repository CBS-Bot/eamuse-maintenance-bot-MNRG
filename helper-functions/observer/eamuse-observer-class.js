/* eslint-disable no-unused-expressions */
class ExtendedMaintenanceObserver {
    #toLocaleTimeStringOptionsVerbose;

    #toLocaleTimeStringOptionsShortCT;

    #toLocaleTimeStringOptionsShortPT;

    #toLocaleDateStringOptions;

    #toLocaleTimeStringOptionsDate;

#lastLoggedMaintenanceWindowKey;

    // Identify the monthly maintenance period whose alert flags we are tracking.
    #maintenanceCycleKey;

    // Remember skip reasons already logged so we only print each reason once per cycle.
    #loggedAlertSkips = new Set();

    // Find the third Tuesday using Japan's calendar year and month (January is month 0).
    // This date holds calendar fields only; getMaintenanceWindowUTC converts them to real times.
    getThirdTuesdayJSTDate(year, month) {
        const firstDayOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        while (firstDayOfMonth.getUTCDay() !== 2) {
            firstDayOfMonth.setUTCDate(firstDayOfMonth.getUTCDate() + 1);
        }
        firstDayOfMonth.setUTCDate(firstDayOfMonth.getUTCDate() + 14);
        return firstDayOfMonth;
    }

    // Convert Tuesday 02:00–07:00 JST to Monday 17:00–22:00 UTC.
    getMaintenanceWindowUTC(extendedMaintenanceDayJST) {
        const maintenanceStartUTC = new Date(extendedMaintenanceDayJST);
        maintenanceStartUTC.setUTCHours(17, 0, 0, 0);
        maintenanceStartUTC.setUTCDate(maintenanceStartUTC.getUTCDate() - 1);

        const maintenanceEndUTC = new Date(extendedMaintenanceDayJST);
        maintenanceEndUTC.setUTCHours(22, 0, 0, 0);
        maintenanceEndUTC.setUTCDate(maintenanceEndUTC.getUTCDate() - 1);

        return {
            maintenanceStartUTC,
            maintenanceEndUTC,
        };
    }

    constructor() {
        // True means we already tried this alert, not that Discord confirmed delivery.
        this.extendedMaintenancePostedFlags = {
            posted3DayWarning: false,
            posted24HourWarning: false,
            posted2HourWarning: false,
            postedBeginsWarning: false,
            postedEndsIn1HourNotice: false,
            postedEndedNotice: false,
        };
        this.nextMaintenanceDate = {
            dateStartUTC: new Date(),
            dateEndUTC: new Date(),
            date: '',
            start: '',
            end: '',
        };
        this.#toLocaleTimeStringOptionsVerbose = {
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        };
        this.#toLocaleTimeStringOptionsShortCT = {
            timeZone: 'America/Chicago',
            hour: '2-digit',
            minute: '2-digit',
        };
        this.#toLocaleTimeStringOptionsShortPT = {
            timeZone: 'America/Los_Angeles',
            hour: '2-digit',
            minute: '2-digit',
        };
        this.#toLocaleDateStringOptions = {
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        };
        this.#toLocaleTimeStringOptionsDate = {
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        };
        this.#lastLoggedMaintenanceWindowKey = '';
    }

    /**
    * Choose an alert message and how Discord should display it.
    * @param {number} index - Which alert message to use.
    * @param {string} dateOfMaintenance - The formatted maintenance date (currently unused).
    * @param {Date} timeStart - The maintenance start time (currently unused).
    * @param {Date} timeEnd - The maintenance end time shown in some messages.
    * @returns {Object} The message text, display format, and whether to attach a calendar file.
     */

    getMessage(index, dateOfMaintenance, timeStart, timeEnd) {
        // const messageBodyBank = [
        //     `⚠️ Warning - In THREE days, the e-amusement Service will be undergoing extended maintenance:\n\nMonday, ${dateOfMaintenance}\nBegins: ${timeStart.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT / ${timeStart.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT \nEnds: ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT / ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT`,
        //     `⚠️ Warning - The e-amusement Service will be undergoing extended maintenance TOMORROW:\n\nMonday, ${dateOfMaintenance}\nBegins: ${timeStart.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT / ${timeStart.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT \nEnds: ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT / ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT`,
        //     `🚨 Alert - In TWO hours, the e-amusement Service will be starting extended maintenance:\n\nBegins: ${timeStart.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT / ${timeStart.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT \nEnds: ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT / ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT`,
        //     `🚨 Alert - The e-amusement Service has started extended maintenance. e-amusement is expected to be back online at ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT / ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT`,
        //     `⚠️ Notice - The e-amusement Service is expected to be back online in ONE hour, at ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT / ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT`,
        //     '✅ Notice - The e-amusement Service is expected to be back online now',
        // ];
        const messageBodyBank = [
            {
                message: '⚠️ Warning - In THREE days, the e-amusement Service will be undergoing extended maintenance:',
                format: 'AS-IS',
                attachICS: true,
            },
            {
                message: '⚠️ Warning - The e-amusement Service will be undergoing extended maintenance TOMORROW:',
                format: 'AS-IS',
                attachICS: true,
            },
            {
                message: '🚨 Alert - In TWO hours, the e-amusement Service will be starting extended maintenance:',
                format: 'AS-IS',
                attachICS: false,
            },
            {
                message: `🚨 Alert - The e-amusement Service has started extended maintenance. e-amusement is expected to be back online at ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT (${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT)`,
                format: 'ONLY-MESSAGE',
                attachICS: false,
            },
            {
                message: `⚠️ Notice - The e-amusement Service is expected to be back online in ONE hour, at ${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT (${timeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT)`,
                format: 'ONLY-MESSAGE',
                attachICS: false,
            },
            {
                message: '✅ Notice - The e-amusement Service is expected to be back online now',
                format: 'ONLY-MESSAGE',
                attachICS: false,
            },
        ];

        return messageBodyBank[index];
    }

    /**
    * Print a message and the flags for debugging; this does not send anything to Discord.
    * @param {Object|string} messageBody - The message to print.
     */

    postMessage(messageBody) {
        console.log('Posted! - ', messageBody);
        console.log('Flags - ', this.extendedMaintenancePostedFlags);
    }

    // Call the posting function and log errors without stopping the observer.
    safePost(callbackGlobalPostAllServers, messageBody) {
        try {
            Promise.resolve(callbackGlobalPostAllServers(messageBody)).catch((error) => {
                console.error(`[${new Date().toISOString()}] Alert callback failed:`, error);
            });
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Alert callback failed:`, error);
        }
    }

    /**
    * Uncheck every alert flag so a new maintenance cycle can send its own alerts.
    * @returns {void}
     */

    resetFlags() {
    // eslint-disable-next-line no-return-assign
        Object.keys(this.extendedMaintenancePostedFlags).forEach((flag) => this.extendedMaintenancePostedFlags[flag] = false);
    }

    /**
    * Check once a second for alerts about the third Tuesday's 02:00–07:00 JST maintenance.
    * The server's local timezone does not affect these checks.
    * @param {Function} callbackGlobalPostAllServers - The function that sends alerts to Discord.
    * @returns {void}
     */

    extendedMaintenanceObserver(callbackGlobalPostAllServers) {
        let messageBody = '';
        const timezoneOffsetJapanUTC = 9;

        // Add 9 hours so UTC getters read Japan's date and time, not the server's local time.
        const now = Date.now();
        const currentDate = new Date(now + (timezoneOffsetJapanUTC * 60 * 60 * 1000));

        let maintenanceYearJST = currentDate.getUTCFullYear();
        let maintenanceMonthJST = currentDate.getUTCMonth();

        let extendedMaintenanceDay = this.getThirdTuesdayJSTDate(maintenanceYearJST, maintenanceMonthJST);
        let {
            maintenanceStartUTC: extendedMaintenanceDayTimeStart,
            maintenanceEndUTC: extendedMaintenanceDayTimeEnd,
        } = this.getMaintenanceWindowUTC(extendedMaintenanceDay);

        // Keep this month's dates until 07:01 JST so the ended alert has a minute to fire.
        // After that, use next month's maintenance dates.
        const nextMonthCutoverTime = extendedMaintenanceDayTimeEnd.getTime() + (60 * 1000);
        if (now >= nextMonthCutoverTime) {
            maintenanceMonthJST += 1;
            if (maintenanceMonthJST > 11) {
                maintenanceMonthJST = 0;
                maintenanceYearJST += 1;
            }

            extendedMaintenanceDay = this.getThirdTuesdayJSTDate(maintenanceYearJST, maintenanceMonthJST);
            ({
                maintenanceStartUTC: extendedMaintenanceDayTimeStart,
                maintenanceEndUTC: extendedMaintenanceDayTimeEnd,
            } = this.getMaintenanceWindowUTC(extendedMaintenanceDay));
        }
        // Use the UTC start time as a unique label for this month's maintenance.
        // When that label changes, uncheck all alerts, even if some were missed last month.
        const maintenanceCycleKey = extendedMaintenanceDayTimeStart.toISOString();
        if (this.#maintenanceCycleKey !== maintenanceCycleKey) {
            this.resetFlags();
            this.#loggedAlertSkips.clear();
            this.#maintenanceCycleKey = maintenanceCycleKey;
            console.log(`[${new Date(now).toISOString()}] Maintenance cycle ${maintenanceCycleKey}: posting flags reset.`);
        }

        // Save the dates before sending, so even the first alert after startup has the right details.
        this.nextMaintenanceDate = {
            dateStartUTC: extendedMaintenanceDayTimeStart,
            dateEndUTC: extendedMaintenanceDayTimeEnd,
            date: `Monday, ${extendedMaintenanceDayTimeStart.toLocaleString('en-US', this.#toLocaleTimeStringOptionsDate)}`,
            start: `${extendedMaintenanceDayTimeStart.toLocaleString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT (${extendedMaintenanceDayTimeStart.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT)`,
            end: `${extendedMaintenanceDayTimeEnd.toLocaleString('en-US', this.#toLocaleTimeStringOptionsShortCT)} CT (${extendedMaintenanceDayTimeEnd.toLocaleTimeString('en-US', this.#toLocaleTimeStringOptionsShortPT)} PT)`,
        };

        // Send an alert only if we have not tried it yet; otherwise log the skip once.
        // The matching alert branch below checks off its flag after this function returns.
        const postAlert = (flag, payload) => {
            if (this.extendedMaintenancePostedFlags[flag]) {
                const skipKey = `${flag}:already-attempted`;
                if (!this.#loggedAlertSkips.has(skipKey)) {
                    console.log(`[${new Date(now).toISOString()}] Alert skipped: ${flag}; cycle=${maintenanceCycleKey}; already attempted this cycle.`);
                    this.#loggedAlertSkips.add(skipKey);
                }
                return;
            }
            console.log(`[${new Date(now).toISOString()}] Alert attempt: ${flag}; cycle=${maintenanceCycleKey}`);
            this.safePost(callbackGlobalPostAllServers, { ...payload, alertId: flag, maintenanceCycleKey });
        };

        // Log missed alert times once. Do not send old warnings when the bot restarts.
        const hour = 60 * 60 * 1000;
        const midnightJST = extendedMaintenanceDayTimeStart.getTime() - (2 * hour);
        const windows = [
            ['posted3DayWarning', midnightJST - (72 * hour), hour],
            ['posted24HourWarning', midnightJST - (24 * hour), hour],
            ['posted2HourWarning', midnightJST, hour],
            ['postedBeginsWarning', extendedMaintenanceDayTimeStart.getTime(), hour],
            ['postedEndsIn1HourNotice', extendedMaintenanceDayTimeEnd.getTime() - hour, hour],
            ['postedEndedNotice', extendedMaintenanceDayTimeEnd.getTime(), 60 * 1000],
        ];
        windows.forEach(([flag, start, duration]) => {
            const skipKey = `${flag}:expired`;
            if (now >= start + duration && !this.extendedMaintenancePostedFlags[flag]
                && !this.#loggedAlertSkips.has(skipKey)) {
                console.warn(`[${new Date(now).toISOString()}] Alert skipped: ${flag}; cycle=${maintenanceCycleKey}; posting window expired without an attempt.`);
                this.#loggedAlertSkips.add(skipKey);
            }
        });

        // Check Japan's calendar date for advance warnings and the maintenance day.
        // Advance warnings can fire during 00:00–00:59 JST on the matching date.
        const is3DaysBeforeExtendedMaintenance = extendedMaintenanceDay.getUTCFullYear() === currentDate.getUTCFullYear()
                                          && extendedMaintenanceDay.getUTCMonth() === currentDate.getUTCMonth()
                                          && (extendedMaintenanceDay.getUTCDate() - currentDate.getUTCDate() === 3)
                                          && (currentDate.getUTCHours() === 0);
        const is1DayBeforeExtendedMaintenance = extendedMaintenanceDay.getUTCFullYear() === currentDate.getUTCFullYear()
                                          && extendedMaintenanceDay.getUTCMonth() === currentDate.getUTCMonth()
                                          && (extendedMaintenanceDay.getUTCDate() - currentDate.getUTCDate() === 1)
                                          && (currentDate.getUTCHours() === 0);
        const isTodayExtendedMaintenance = extendedMaintenanceDay.getUTCFullYear() === currentDate.getUTCFullYear()
                                    && extendedMaintenanceDay.getUTCMonth() === currentDate.getUTCMonth()
                                    && extendedMaintenanceDay.getUTCDate() === currentDate.getUTCDate();

        // Check Japan's clock for the two-hour, started, ending-soon, and ended alerts.
        // Alerts have an hour to fire, except the ended alert, which has until 07:01 JST.

        const is2HoursBeforeExtendedMaintenance = isTodayExtendedMaintenance && (currentDate.getUTCHours() === 0);
        const isExactlyExtendedMaintenance = isTodayExtendedMaintenance && (currentDate.getUTCHours() === 2);
        const is1HourBeforeExtendedMaintenanceEnds = isTodayExtendedMaintenance && (currentDate.getUTCHours() === 6);
        const extendedMaintenanceEnds = isTodayExtendedMaintenance && (currentDate.getUTCHours() === 7);
        const isPastExtendedMaintenance = isTodayExtendedMaintenance
            && (currentDate.getUTCHours() > 7 || (currentDate.getUTCHours() === 7 && currentDate.getUTCMinutes() >= 1));

        // Build the matching alert, try sending it once, and check off its flag.
        if (is3DaysBeforeExtendedMaintenance) {
            messageBody = this.getMessage(
                0,
                extendedMaintenanceDayTimeStart.toLocaleString('en-US', this.#toLocaleDateStringOptions),
                extendedMaintenanceDayTimeStart,
                extendedMaintenanceDayTimeEnd,
            );
            postAlert('posted3DayWarning', messageBody);
            this.extendedMaintenancePostedFlags.posted3DayWarning = true;
        } else if (is1DayBeforeExtendedMaintenance) {
            messageBody = this.getMessage(
                1,
                extendedMaintenanceDayTimeStart.toLocaleString('en-US', this.#toLocaleDateStringOptions),
                extendedMaintenanceDayTimeStart,
                extendedMaintenanceDayTimeEnd,
            );
            postAlert('posted24HourWarning', messageBody);
            this.extendedMaintenancePostedFlags.posted24HourWarning = true;
        } else if (is2HoursBeforeExtendedMaintenance) {
            messageBody = this.getMessage(
                2,
                extendedMaintenanceDayTimeStart.toLocaleString('en-US', this.#toLocaleDateStringOptions),
                extendedMaintenanceDayTimeStart,
                extendedMaintenanceDayTimeEnd,
            );
            postAlert('posted2HourWarning', messageBody);
            this.extendedMaintenancePostedFlags.posted2HourWarning = true;
        } else if (isExactlyExtendedMaintenance) {
            messageBody = this.getMessage(
                3,
                extendedMaintenanceDayTimeStart.toLocaleString('en-US', this.#toLocaleDateStringOptions),
                extendedMaintenanceDayTimeStart,
                extendedMaintenanceDayTimeEnd,
            );
            postAlert('postedBeginsWarning', messageBody);
            this.extendedMaintenancePostedFlags.postedBeginsWarning = true;
        } else if (is1HourBeforeExtendedMaintenanceEnds) {
            messageBody = this.getMessage(
                4,
                extendedMaintenanceDayTimeStart.toLocaleString('en-US', this.#toLocaleDateStringOptions),
                extendedMaintenanceDayTimeStart,
                extendedMaintenanceDayTimeEnd,
            );
            postAlert('postedEndsIn1HourNotice', messageBody);
            this.extendedMaintenancePostedFlags.postedEndsIn1HourNotice = true;
        } else if (extendedMaintenanceEnds) {
            messageBody = this.getMessage(
                5,
                extendedMaintenanceDayTimeStart.toLocaleString('en-US', this.#toLocaleDateStringOptions),
                extendedMaintenanceDayTimeStart,
                extendedMaintenanceDayTimeEnd,
            );
            !isPastExtendedMaintenance && postAlert('postedEndedNotice', messageBody);
            this.extendedMaintenancePostedFlags.postedEndedNotice = true;
        }

        // Print the maintenance dates only when they change.
        const currentMaintenanceWindowKey = `${extendedMaintenanceDayTimeStart.getTime()}-${extendedMaintenanceDayTimeEnd.getTime()}`;
        if (this.#lastLoggedMaintenanceWindowKey !== currentMaintenanceWindowKey) {
            console.log('Maintenance window updated:');
            console.log('US/Chicago start:', extendedMaintenanceDayTimeStart.toLocaleString('en-US', this.#toLocaleTimeStringOptionsVerbose));
            console.log('US/Chicago end:', extendedMaintenanceDayTimeEnd.toLocaleString('en-US', this.#toLocaleTimeStringOptionsVerbose));
            this.#lastLoggedMaintenanceWindowKey = currentMaintenanceWindowKey;
        }

    }
}

export default ExtendedMaintenanceObserver;
