import assert from 'node:assert/strict';
import test from 'node:test';
import ExtendedMaintenanceObserver from '../helper-functions/observer/eamuse-observer-class.js';

test('monthly flags reset and rollout preserves remaining alerts', () => {
    const originalNow = Date.now;
    const originalLog = console.log;
    const originalWarn = console.warn;
    const logs = [];
    console.log = (...args) => logs.push(args.join(' '));
    console.warn = (...args) => logs.push(args.join(' '));
    const observer = new ExtendedMaintenanceObserver();
    const sent = [];
    const tick = (jst, instance = observer, callback = (payload) => {
        assert.equal(instance.nextMaintenanceDate.dateStartUTC.toISOString(), payload.maintenanceCycleKey);
        sent.push(payload);
    }) => {
        Date.now = () => Date.parse(jst);
        instance.extendedMaintenanceObserver(callback);
    };

    try {
        // A single process, with no restart between September and October.
        tick('2026-09-12T00:00:00+09:00');
        tick('2026-09-12T00:00:01+09:00');
        assert.equal(sent.length, 1);
        tick('2026-09-15T07:00:30+09:00');
        assert.equal(sent.at(-1).alertId, 'postedEndedNotice');
        tick('2026-09-15T07:01:00+09:00');
        assert.ok(Object.values(observer.extendedMaintenancePostedFlags).every((flag) => !flag));
        assert.equal(observer.nextMaintenanceDate.dateStartUTC.toISOString(), '2026-10-19T17:00:00.000Z');
        tick('2026-10-17T00:00:00+09:00');
        tick('2026-10-19T00:30:00+09:00');
        assert.deepEqual(sent.slice(-2).map((payload) => payload.alertId), ['posted3DayWarning', 'posted24HourWarning']);

        // Deploy after advance windows; do not replay them, but send remaining alerts.
        const deployed = new ExtendedMaintenanceObserver();
        const delivered = [];
        const callback = (payload) => {
            assert.equal(deployed.nextMaintenanceDate.dateStartUTC.toISOString(), payload.maintenanceCycleKey);
            delivered.push(payload.alertId);
        };
        tick('2026-10-20T01:30:00+09:00', deployed, callback);
        tick('2026-10-20T01:30:01+09:00', deployed, callback);
        assert.equal(delivered.length, 0);
        tick('2026-10-20T02:15:00+09:00', deployed, callback);
        tick('2026-10-20T02:15:01+09:00', deployed, callback);
        tick('2026-10-20T06:00:00+09:00', deployed, callback);
        tick('2026-10-20T07:00:59+09:00', deployed, callback);
        assert.deepEqual(delivered, ['postedBeginsWarning', 'postedEndsIn1HourNotice', 'postedEndedNotice']);
        tick('2026-10-20T07:01:00+09:00', deployed, callback);
        assert.ok(Object.values(deployed.extendedMaintenancePostedFlags).every((flag) => !flag));
        tick('2026-11-14T00:00:00+09:00', deployed, callback);
        assert.equal(delivered.at(-1), 'posted3DayWarning');
        assert.ok(logs.some((line) => line.includes('Alert attempt:')));
        assert.ok(logs.some((line) => line.includes('already attempted this cycle')));
        assert.equal(logs.filter((line) => line.includes('posted24HourWarning')
            && line.includes('cycle=2026-10-19T17:00:00.000Z')
            && line.includes('posting window expired')).length, 1);
    } finally {
        Date.now = originalNow;
        console.log = originalLog;
        console.warn = originalWarn;
    }
});