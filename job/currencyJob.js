const redis = require('redis');
const {promisify} = require('util');
const fs = require('fs');

const hb_currency = require('../sdk/hb_currency');
const sendMail = require('../email/mail');

var config = {
    access_key : '0e44466a-072c6d96-121dc8f5-bd52d',
    secretkey : '079f54ea-165848f7-aefbc94c-70cea'
}

let Job = async function()  {
    
    let readFile = promisify(fs.readFile).bind(fs);
    let writeFile = promisify(fs.writeFile).bind(fs);
    let fileExists = promisify(fs.exists).bind(fs);

    //资源文件路径
    let resourceURL = `${__dirname}/resource`;
    
    let exists = await fileExists(resourceURL+'/currencyList');
    if(exists == false){
        let data = await writeFile(resourceURL+'/currencyList',"eosusdt,xrpusdt,ethusdt,btcusdt,htusdt,sntbtc,ltcusdt");
        return false;
    }
    let rsu = await readFile(resourceURL+'/currencyList');
    let curr = rsu.toString().split(',');
    for(let i =0;i < curr.length ;i++){
        let this_cur = curr[i]; //当前货币对
        //获取当前货币对价格
        let amount = await hb_currency.get_currency(this_cur,config);
        // console.log(amount[0].close);
        //获取之前记录价格
        let exists = await fileExists(resourceURL+'/'+this_cur);
        if(exists == false){
            let cur_str = `{"${this_cur}":"${amount[0].close}","dataTime":"${new Date().Format('yyyy-MM-dd hh:mm:ss')}"}`;
            let data = await writeFile(resourceURL+'/'+this_cur,cur_str);
            return false;
        }
        let symbol = await readFile(resourceURL+'/'+this_cur);
        symbol = JSON.parse(symbol.toString());

        let msg = '';
        if(amount[0].close > symbol[this_cur]){
            msg = "上涨";
        }else{
            msg = "下跌";
        }
        //波动百分比
        let rose =(amount[0].close - symbol[this_cur]) / amount[0].close * 100;
        rose = rose.toFixed(2);
        console.log(`当前货币对：${this_cur},价格：${amount[0].close},波动(${msg}${rose}%),上次记录价格：${symbol[this_cur]},上次记录时间是：${symbol.dataTime}`);
        if(rose >= 2.0 || rose <= -2.0 ){
            let str = `${this_cur}：5min内波动(${msg}${rose}%),当前价格：${amount[0].close},之前价格：${symbol[this_cur]}`;
            console.log(`发邮件之前`);
            let userList = await readFile(resourceURL+'/userEmail');
            userList = JSON.parse(userList.toString());
            for(let i =0; i < userList.length; i++){
                let user = userList[i];
                if(user.currency.indexOf(this_cur) != -1){
                    console.log(`发送邮件...${this_cur}: 发送给 ${user.user}`);
                    sendMail(user.user,str,str);
                }
            }
            let cur_str = `{"${this_cur}":"${amount[0].close}","dataTime":"${new Date().Format('yyyy-MM-dd hh:mm:ss')}"}`;
            let isup = await writeFile(resourceURL+'/'+this_cur,cur_str);
            console.log(`修改：${cur_str}`);
            console.log(`修改结果：${isup}`);
        }

        symbol = await readFile(resourceURL+'/'+this_cur);
        symbol = JSON.parse(symbol.toString());

        let date = new Date();
        let beforeDate = new Date().convertDateFromString(symbol.dataTime);

        let differ = ((date.getTime() - beforeDate.getTime()) / 1000 /60).toFixed(2);
        if(differ > 5){
            let cur_str = `{"${this_cur}":"${amount[0].close}","dataTime":"${new Date().Format('yyyy-MM-dd hh:mm:ss')}"}`;
            let isup = await writeFile(resourceURL+'/'+this_cur,cur_str);
            console.log(`5min修改：${this_cur}`);
        }
    }
}

Date.prototype.convertDateFromString = function convertDateFromString(dateString) {
    if (dateString) { 
        var date = new Date(dateString.replace(/-/,"/")) 
        return date;
    }
}

// yyyy-MM-dd hh:mm:ss
Date.prototype.Format=function(fmt) {         
    var o = {         
    "M+" : this.getMonth()+1, //月份         
    "d+" : this.getDate(), //日         
    "h+" : this.getHours(), //小时         
    "H+" : this.getHours(), //小时         
    "m+" : this.getMinutes(), //分         
    "s+" : this.getSeconds(), //秒         
    "q+" : Math.floor((this.getMonth()+3)/3), //季度         
    "S" : this.getMilliseconds() //毫秒         
    };         
    var week = {         
    "0" : "/u65e5",         
    "1" : "/u4e00",         
    "2" : "/u4e8c",         
    "3" : "/u4e09",         
    "4" : "/u56db",         
    "5" : "/u4e94",         
    "6" : "/u516d"        
    };         
    if(/(y+)/.test(fmt)){         
        fmt=fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length));         
    }         
    if(/(E+)/.test(fmt)){         
        fmt=fmt.replace(RegExp.$1, ((RegExp.$1.length>1) ? (RegExp.$1.length>2 ? "/u661f/u671f" : "/u5468") : "")+week[this.getDay()+""]);         
    }         
    for(var k in o){         
        if(new RegExp("("+ k +")").test(fmt)){         
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));         
        }         
    }         
    return fmt;         
}

module.exports = Job;

// Job();