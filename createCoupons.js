

if (process.argv.length != 3){
    console.log("usage: node createCoupons.js [path_to_csv]");
    return 1;
}
var couponCsvFile = process.argv[2];



var querystring = require('querystring');
var https = require('https');
var csv = require('node-csv').createParser();
var config = require('config');
//...
var clientConfig = config.get('clientConfig');

if (!validateConfig(clientConfig)){
    return -1;
}

var cName = {
    "COUPON_NAME": "Name",
    "COUPON_CODE": "Promo Code",
    "COUPON_TYPE": "Usage",
    "COUPON_PERCENT": "Percent",
    "COUPON_VALUE": "Monetary Value",
    "COUPON_SHIPPING_VALUE": "No Ship Costs",
    "COUPON_MIN_ORDER_AMOUNT": "Min Order Amt",
    "COUPON_NUM_USES": "Num Uses",
    "COUPON_EXPIRES": "Expires"

};

function validateConfig(clientConfig) {

    if (clientConfig.password == '' || clientConfig.password == null) {console.log("password is missing") ; return false;}
    if (clientConfig.username == '' || clientConfig.username == null) {console.log("username is missing") ; return false;}
    if (clientConfig.clientId == '' || clientConfig.clientId == null) {console.log("clientId is missing") ; return false;}
    if (clientConfig.clientSecret == '' || clientConfig.clientSecret == null) {console.log("clientSecret is missing") ; return false;}
    if (clientConfig.host == '' || clientConfig.host == null) {console.log("host is missing") ; return false;}

    return true;
}


function authenticate(clientConfig,cb) {
    try{

        // Build the post string from an object
        var post_data = querystring.stringify({
            'grant_type' : 'password',
            'password': clientConfig.password,
            'username': clientConfig.username,
            'client_id' : clientConfig.clientId,
            'client_secret' : clientConfig.clientSecret,
            'scope' : 'core.coupons.read,core.coupons.write'
        });

        // An object of options to indicate where to post to
        var post_options = {
            host: clientConfig.host ,
            path: '/oauth/access_token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(post_data)
            }
        };

        // Set up the request
        var post_req = https.request(post_options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                var responseObject = JSON.parse(chunk);
                console.log('Response: ' , responseObject);
                cb(responseObject);
            });
        });

        // post the data
        post_req.write(post_data);
        post_req.end();
    }catch(e){
        console.log("Error authenticating to the api.",e);
    }

}

try{
    authenticate(clientConfig,function(authObject){
        csv.mapFile(couponCsvFile, function(err, data) {
            //console.log(data);

            var couponsToCreate = [];
            for (var i=0;i<data.length;i++){
                //console.log(data[i] );
                var coupon = getCouponFromExcelDataRow(data[i]);
                if (coupon.code != '' && coupon.code != null){
                    couponsToCreate.push(coupon);
                }



            }

            function create(){
                if (couponsToCreate.length > 0){

                    try{
                        var couponToCreate = couponsToCreate.pop();
                        if (couponToCreate != null){
                            createCoupon(couponToCreate,authObject.access_token,create);
                        }

                    }catch(e){
                        console.log("Error creating coupon.",couponToCreate,e);
                        create();
                    }

                }

            }
            create();


        });

    });
}catch(ex){
    console.log("Error while authenticating.",ex)
}







function createCoupon(coupon,authToken,cb){

    //call the api
    console.log("About to create coupon ",coupon );

    var post_data = JSON.stringify(coupon);

    // An object of options to indicate where to post to
    var post_options = {
        host: 'api.getphoto.io',
        path: '/v4/coupons',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(post_data),
            'Authorization' : 'Bearer ' + authToken
        }
    };

    // Set up the request
    var post_req = https.request(post_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            var responseObject = JSON.parse(chunk);
            if (responseObject.errors){
                console.log('Failed to create coupon: ' , responseObject);
            }else{
                console.log('Created coupon with id: ' , responseObject);
            }

            cb(responseObject);
        });
    });

    // post the data
    post_req.write(post_data);
    post_req.end();


}

function getParsedDate(dt){
    var pDate = Date.parse(dt);

    if (isNaN(pDate)){
        console.log("Could not parse the date for row");
        return null;
    }else{
        var dateObject = new Date(pDate);
        return dateObject.toISOString();
    }
}

function prepareMoneyMount(amount){


    if (!amount){
        return 0;
    }
    var cleanAmount = amount.replace(/^\s+|\s+$|\$/g, '');
    var retVal = new Number(cleanAmount);

    // retVal =  (retVal / .92); //boosting sales tax since their api automatically deducts this amount ... no way around id for now.


    return retVal;

}


function getCouponFromExcelDataRow(excelRowObject){

    return {
        "name": excelRowObject[cName["COUPON_NAME"]],
        "code": excelRowObject[cName["COUPON_CODE"]],
        "type": excelRowObject[cName["COUPON_TYPE"]],
        "product_percent": excelRowObject[cName["COUPON_PERCENT"]],
        "product_value_net":
        {
            "amount": prepareMoneyMount(excelRowObject[cName["COUPON_VALUE"]]),
            "currency": "USD"
        }
    ,
        "shipping_value":
        {
            "amount": prepareMoneyMount(excelRowObject[cName["COUPON_SHIPPING_VALUE"]]),
            "currency": "USD"
        }
    ,
        "minimum_basket_sum":
        {
            "amount": prepareMoneyMount(excelRowObject[cName["COUPON_MIN_ORDER_AMOUNT"]]),
            "currency": "USD"
        }
    ,
        "max_uses": excelRowObject[cName["COUPON_NUM_USES"]],
        "max_uses_per_password": excelRowObject[cName["COUPON_NUM_USES"]],
        "valid_until":getParsedDate( excelRowObject[cName["COUPON_EXPIRES"]])
    };


}




