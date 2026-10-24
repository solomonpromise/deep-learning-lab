/* Native video controls with deliberate loading, accessible chapter links and section-aware pausing. */
(function () {
  'use strict';
  var players=Array.from(document.querySelectorAll('[data-lesson-video]'));
  players.forEach(function(root){
    var video=root.querySelector('video'),play=root.querySelector('[data-video-play]'),speed=root.querySelector('[data-video-speed]'),error=root.querySelector('[data-video-error]'),pending=null;
    var captions=root.querySelector('[data-video-captions]'),track=video.querySelector('track');
    play.hidden=false;captions.hidden=false;root.querySelector('[data-video-speed-label]').hidden=false;
    function syncCaptions(){
      var showing=video.textTracks.length && video.textTracks[0].mode==='showing';
      captions.setAttribute('aria-pressed',showing?'true':'false');
      captions.textContent=(showing?'Hide ':'Show ')+captions.dataset.captionLabel;
    }
    captions.addEventListener('click',function(){
      if(!track.getAttribute('src'))track.src=track.dataset.captionSrc;
      if(video.textTracks.length)video.textTracks[0].mode=video.textTracks[0].mode==='showing'?'disabled':'showing';
      syncCaptions();
    });
    video.textTracks.addEventListener('change',syncCaptions);syncCaptions();
    function load(){
      if(!video.getAttribute('src')){
        video.src=video.dataset.videoSrc;
        if(!track.getAttribute('src'))track.src=track.dataset.captionSrc;
        video.load();
      }
    }
    function start(at){
      error.hidden=true;play.querySelector('span').textContent='Loading video…';load();
      if(typeof at==='number'){
        if(video.readyState>=1)video.currentTime=Math.min(at,Math.max(0,video.duration-.05));
        else pending=at;
      }
      if(video.error)video.load();
      var promise=video.play();
      if(promise)promise.catch(function(e){
        if(e.name==='AbortError'||e.name==='NotAllowedError'){play.querySelector('span').textContent='Play animation';return;}
        if(e.name!=='NotAllowedError'){error.hidden=false;play.hidden=false;play.querySelector('span').textContent='Try again';}
      });
    }
    play.addEventListener('click',function(){start();});
    video.addEventListener('loadedmetadata',function(){if(pending!==null){video.currentTime=Math.min(pending,Math.max(0,video.duration-.05));pending=null;}video.playbackRate=Number(speed.value);});
    video.addEventListener('playing',function(){play.hidden=true;error.hidden=true;play.querySelector('span').textContent='Play animation';});
    video.addEventListener('play',function(){players.forEach(function(other){if(other!==root)other.querySelector('video').pause();});});
    video.addEventListener('error',function(){error.hidden=false;play.hidden=false;play.querySelector('span').textContent='Try again';});
    speed.addEventListener('change',function(){video.playbackRate=Number(speed.value);});
    root.querySelectorAll('[data-video-seek]').forEach(function(link){link.addEventListener('click',function(e){if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();start(Number(link.dataset.videoSeek));});});
  });
  function pauseHidden(){players.forEach(function(root){if(document.hidden||!root.getClientRects().length)root.querySelector('video').pause();});}
  document.addEventListener('dlp:section-shown',pauseHidden);
  document.addEventListener('visibilitychange',pauseHidden);
  window.addEventListener('pagehide',function(){players.forEach(function(root){root.querySelector('video').pause();});});
})();
