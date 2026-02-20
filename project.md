# Goal

The goal here is to create a browser plugin (Chromiun only)

The plugin will fetch data from the XHR requests for the TrainingPeaks website.

Since it needs authentication, all the tests must happen in an existing browser session

We need to fetch workouts from their API

# APIs


## This cURL request fetches the user

curl 'https://tpapi.trainingpeaks.com/users/v3/user' \
  -H 'accept: application/json, text/javascript, */*; q=0.01' \
  -H 'accept-language: en-GB,en;q=0.8' \
  -H 'authorization: Bearer [bearer_token]6v8gVFmspiQW-tOJ193FloocEtkhy8biT2kQvgqBaywkHa0u63SB7locdCcRPIpFnZYwXbDI' \
  -H 'content-type: application/json' \
  -H 'origin: https://app.trainingpeaks.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://app.trainingpeaks.com/' \
  -H 'sec-ch-ua: "Not:A-Brand";v="99", "Brave";v="145", "Chromium";v="145"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'sec-gpc: 1' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'

The response is a json with the content like in this file @user.json


## This cURL request fetches all the libraries

We should use it to list to the user all the available libraries and their ownners

    curl 'https://tpapi.trainingpeaks.com/exerciselibrary/v2/libraries' \
      -H 'accept: application/json, text/javascript, */*; q=0.01' \
      -H 'accept-language: en-GB,en;q=0.8' \
      -H 'authorization: Bearer [bearer_token]' \
      -H 'content-type: application/json' \
      -H 'origin: https://app.trainingpeaks.com' \
      -H 'priority: u=1, i' \
      -H 'referer: https://app.trainingpeaks.com/' \
      -H 'sec-ch-ua: "Not:A-Brand";v="99", "Brave";v="145", "Chromium";v="145"' \
      -H 'sec-ch-ua-mobile: ?0' \
      -H 'sec-ch-ua-platform: "macOS"' \
      -H 'sec-fetch-dest: empty' \
      -H 'sec-fetch-mode: cors' \
      -H 'sec-fetch-site: same-site' \
      -H 'sec-gpc: 1' \
      -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'

The response is a json with the content like in this file @library_list.json


## Get the library content

we use this to fetch the content from each library

    curl 'https://tpapi.trainingpeaks.com/exerciselibrary/v2/libraries/[library_id]/items' \
      -H 'accept: application/json, text/javascript, */*; q=0.01' \
      -H 'accept-language: en-GB,en;q=0.8' \
      -H 'authorization: Bearer [bearer_token]' \
      -H 'content-type: application/json' \
      -H 'origin: https://app.trainingpeaks.com' \
      -H 'priority: u=1, i' \
      -H 'referer: https://app.trainingpeaks.com/' \
      -H 'sec-ch-ua: "Not:A-Brand";v="99", "Brave";v="145", "Chromium";v="145"' \
      -H 'sec-ch-ua-mobile: ?0' \
      -H 'sec-ch-ua-platform: "macOS"' \
      -H 'sec-fetch-dest: empty' \
      -H 'sec-fetch-mode: cors' \
      -H 'sec-fetch-site: same-site' \
      -H 'sec-gpc: 1' \
      -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'



The response is a json with the content like in this file @library_data.json


At this stage the plugin should validate the user is logged in on TrainingPeaks and display the libraries.


This plugin is not public, but I want to be able to share it with many users