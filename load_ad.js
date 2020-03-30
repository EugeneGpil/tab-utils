import load_script from './private/load_script';
import remove_hash from './private/remove_hash';

export default loadAd;

function loadAd(AD_SLOTS) {
  if( remove_ad() ){
    return;
  }

  loadGoogleTag(AD_SLOTS);

  loadApsTag();

  refreshBids(AD_SLOTS);

  AD_SLOTS.forEach(({slotID}) => {
    googletag.cmd.push(function() { googletag.display(slotID); });
  });

  setInterval(function () {
    refreshBids(AD_SLOTS, {timeout: 2e3});
  }, 90000);
}

function loadGoogleTag(AD_SLOTS) {
  load_script("https://securepubads.g.doubleclick.net/tag/js/gpt.js");

  window.googletag = window.googletag || {cmd: []};
  googletag.cmd.push(function() {
    const Desktop_Banner_728 = (
      googletag
      .sizeMapping()
      .addSize([728, 0], [728, 90]) //desktop
      .addSize([0, 0], []) //other
      .build()
    );

    const Mobile_Banner_300 = (
      googletag
      .sizeMapping()
      .addSize([728, 0], []) //desktop
      .addSize([0, 0], [320, 50]) //other
      .build()
    );

    AD_SLOTS.forEach(({slotID, slotName, slotSize}) => {
      const is_mobile = slotName.toLowerCase().includes('mobile');

      let banner_size_map;
      if( is_mobile ) {
        banner_size_map = Mobile_Banner_300;
      } else {
        banner_size_map = Desktop_Banner_728;
      }

      googletag
      .defineSlot(slotName, slotSize, slotID)
      .defineSizeMapping(banner_size_map)
      .addService(googletag.pubads());

      console.log('[AD] Defined '+(is_mobile?'mobile':'desktop')+' ad with id '+slotID+' name '+slotName+' and size '+slotSize);
    });

    googletag.pubads().disableInitialLoad();
 // googletag.pubads().enableSingleRequest();
    googletag.enableServices();
  });
}

function refreshBids(AD_SLOTS, args) {
  apstag.fetchBids(
    {
      slots: AD_SLOTS.map(({slotID, slotName, slotSize}) => {
        return {
          slotID,
          slotName,
          sizes: [slotSize],
        };
      }),
      ...args
    },
    function(bids) {
      // set apstag bids, then trigger the first request to DFP

      // set apstag targeting on googletag then refresh all DFP

      googletag.cmd.push(function() {
          apstag.setDisplayBids();
          googletag.pubads().refresh();
          console.log('[AD] Bid refresh');
      });
    }
  );
}

function loadApsTag() {
  !function(a9,a,p,s,t,A,g){if(a[a9])return;function q(c,r){a[a9]._Q.push([c,r])}a[a9]={init:function(){q("i",arguments)},fetchBids:function(){q("f",arguments)},setDisplayBids:function(){},targetingKeys:function(){return[]},_Q:[]};A=p.createElement(s);A.async=!0;A.src=t;g=p.getElementsByTagName(s)[0];g.parentNode.insertBefore(A,g)}("apstag",window,document,"script","//c.amazon-adsystem.com/aax2/apstag.js");

  const pubID = 'f6d6bc2e-7f12-42a3-83a2-6035f3b14586';

  apstag.init({
     pubID,
     adServer: 'googletag',
     bidTimeout: 2e3
  });

  console.log('[AD] ApsTag initialized with pubID '+pubID);
}


// Since Clock/Timer Tab's source code is open anyone can read this and bypass doing a donation to remove ads.
// If you are short on money then you are more than welcome to do this :-).
function remove_ad() {
  if( codeIsInUrl()===true ){
    return true;
  }
  if( codeIsInLocalStorage()===true ){
    return true;
  }

  document.documentElement.classList.add('show_ad');

  return false;

  function codeIsInUrl() {
    if( window.location.hash==='#thanks-for-your-donation' ){
      window.localStorage.setItem('thanks-for-your-donation', '1');
      remove_hash();
      return true;
    }
    return false;
  }

  function codeIsInLocalStorage() {
    return !!window.localStorage.getItem('thanks-for-your-donation');
  }
}
