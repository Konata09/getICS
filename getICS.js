const axios = require('axios');
const fs = require('fs').promises;
const SocksProxyAgent = require('socks-proxy-agent');
const dayjs = require('dayjs');

let conf = {
    "site": "",
    "xh": "",
    "password": "",
    "firstWeek": "20200831",
    "xnxqid": "2020-2021-1",
    "proxy": "",
    "filename": "calendar.ics"
}

const ua = 'Mozilla/5.0 (Winsdows NT 10.0; Win64; x64; rv:79.0) Gecko/20100101 Firefox/79.0'
const weekMonday = new Array(31);
let agent = undefined;

// 初始化 设置代理 查询
async function init() {
    if (conf.proxy !== '') {
        agent = new SocksProxyAgent(conf.proxy);
    }
    try {
        await createFile(conf.filename);
    } catch (err) {
        console.log(err);
    }
    getEachWeekDay();
    const token = await apiLogin().catch(err => console.log('账号登录失败\n' + err));
    await Promise.all(weekMonday.map((monday, week) => {
        return new Promise((resolve, reject) => {
            getData(token, week + 1)
                .then(res => { if (res) parseData(monday, res.data) })
                .then(() => resolve())
                .catch(err => reject(err))
        })
    }))
        .catch(err => console.log(err));
    appendFile('END:VCALENDAR');
    console.log("下载完成");
}

// 计算每个周一的日期并存储
const getEachWeekDay = () => {
    let mondayDate = dayjs(conf.firstWeek);
    for (let i = 0; i < 30; i++) {
        weekMonday[i] = mondayDate;
        mondayDate = mondayDate.add(7, 'day');
    }
}

// 获取指定周的课程表
function getData(token, zc) {
    return new Promise((resolve) => {
        axios({
            url: `http://${conf.site}/app.do?method=getKbcxAzc&xh=${conf.xh}&xnxqid=${conf.xnxqid}&zc=${zc}`,
            method: 'GET',
            headers: {
                'User-Agent': ua,
                'token': token
            },
            timeout: 5000,
            httpAgent: agent
        })
            .catch(err => console.log(`ERROR: 第${zc}周查询失败 ${err}`))
            .then(res => {
                if (JSON.stringify(res.data[0]) === 'null') console.log(`INFO: 第${zc}周无课 `) || resolve();
                else resolve(res)
            });
    })
}

// 将 json 数据解析成 iCalendar 数据
function parseData(monday, data) {
    return new Promise((resolve, reject) => {
        const now = dayjs();
        for (event in data) {
            let day = data[event].kcsj.slice(0, 1);
            curday = monday.add(day - 1, 'day');
            try {
                appendFile(
                    `BEGIN:VEVENT
DTSTART;TZID=Asia/Shanghai:${curday.format('YYYYMMDD')}T${data[event].kssj.replace(/:/, '')}00
DTEND;TZID=Asia/Shanghai:${curday.format('YYYYMMDD')}T${data[event].jssj.replace(/:/, '')}00
DTSTAMP:${now.format('YYYYMMDD[T]HHmmss[Z]')}
CREATED:${now.format('YYYYMMDD[T]HHmmss[Z]')}
DESCRIPTION:
LAST-MODIFIED:${now.format('YYYYMMDD[T]HHmmss[Z]')}
LOCATION:${data[event].jsmc} ${data[event].jsxm}
SEQUENCE:0
STATUS:CONFIRMED
SUMMARY:${data[event].kcmc}
TRANSP:OPAQUE
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:This is an event reminder
TRIGGER:-P0DT0H15M0S
END:VALARM
END:VEVENT
`
                )
            }
            catch (err) {
                reject(err);
            }
            resolve();
        }
    })
}

// api 登录
function apiLogin() {
    return new Promise((resolve, reject) => {
        axios({
            url: `http://${conf.site}/app.do?method=authUser&xh=${conf.xh}&pwd=${conf.password}`,
            method: 'GET',
            headers: {
                'User-Agent': ua,
            },
            timeout: 5000,
            httpAgent: agent
        }).then((res) => {
            token = res.data.token;
            if (token === '-1')
                reject(res.data.msg);
            else
                resolve(token);
        }).catch((err) => (reject(err)));
    });
}

// 创建文件
function createFile(filename) {
    return fs.writeFile(filename,
        `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-TIMEZONE:Asia/Shanghai
BEGIN:VTIMEZONE
TZID:Asia/Shanghai
X-LIC-LOCATION:Asia/Shanghai
BEGIN:STANDARD
TZOFFSETFROM:+0800
TZOFFSETTO:+0800
TZNAME:CST
DTSTART:19700101T000000
END:STANDARD
END:VTIMEZONE
`, { encoding: 'utf8', flag: 'w' }, err => {
        if (err) throw err;
    })
}

// 向文件中追加内容
function appendFile(content) {
    return fs.writeFile(conf.filename, content, { encoding: 'utf8', flag: 'a' }, err => {
        if (err) throw err;
    });
}

init();