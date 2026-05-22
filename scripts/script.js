// - temp <3

if (screen.width <= 699) {
  window.location.href = "https://t3mp.co.uk/mobile";
}

let waitingForFirstPress = true;

// enables music with user interaction or click
window.addEventListener("keydown", function (event) { 
  if (waitingForFirstPress) {
    toggleMusic = 2; 
    updateMusicIcon(); 
    console.log(event.code); 
    event.preventDefault(); // dunno why but this just makes it work lol
    waitingForFirstPress = false;
  }
});

window.addEventListener("click", function (event) { 
  if (waitingForFirstPress) {
    toggleMusic = 2; 
    updateMusicIcon(); 
    console.log(event.code); 
    event.preventDefault(); // dunno why but this just makes it work lol
    waitingForFirstPress = false;
  }
});

let otherIndex = 0;
let abletoswipe = true;
let canNavigate = true;
const cooldownDuration = 500; // cooldown duration in milliseconds

// paralax effect
const layers = document.querySelectorAll('.layer');
const strength = [.05, .035, 0.02];

// recognise mouse
document.addEventListener('mousemove', (event) => {
  const { clientX, clientY } = event;
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  layers.forEach((layer, index) => {
    const x = (clientX - centerX) * strength[index];
    const y = (clientY - centerY) * strength[index];
    layer.style.transform = `translate(${x}px, ${y}px)`;
  });
});

// nav
document.addEventListener("DOMContentLoaded", function () {
  const contentContainer = document.querySelector(".content-container");
  const navButtons = document.querySelectorAll(".nav-button");
  const showContentButton = document.getElementById("showContentButton");
  const showContentButtonDiv = document.getElementById("showContentButtonDiv");
  const index = document.getElementById("index");
});

const hover = document.getElementById("hover"); 
const select = document.getElementById("select"); 

// social media links
document.addEventListener('mouseover', (e) => {
  if (e.target.closest('[href*="https://"], [href*="mailto:"], [href*="discord://"]') !== null) {
    hover.currentTime = 0;
    hover.volume = hovervolume;
hover.play();
  }
});

//   sound on hover and click
document.addEventListener('click', (e) => {
  if (e.target.closest('[href*="https://"]') !== null) {
    select.volume = hovervolume;
select.play();
  }
});

document.addEventListener("DOMContentLoaded", function () {
  // load audio
  const silentAudio = document.getElementById('silentAudio');

  silentAudio.play().then(() => {
      silentAudio.pause();
  });


    let currentIndex = 0;
    const totalDivs = 5;
    const divs = document.querySelectorAll(".div-content");

    function update() {
      setInterval(() => {
          switchMusic(currentIndex + 1); 
      }, 100); 
  }

  // div handling
  update(); 
    function showDiv(index) {
        divs.forEach((div, i) => {
            if (i === index) {
                div.classList.add("active"); 
            } else {
                div.classList.remove("active"); 
            }
        });
        console.log(index);
        switchMusic([index+1]); 
        currentIndex = index;
        otherIndex=currentIndex;
        changeIcons()
        updateMusicIcon()
    }

    showDiv(currentIndex);

    //handle touchstart event
    function handleTouchStart(evt) {
      if (abletoswipe == true) {
        xDown = evt.touches[0].clientX;
    }};

    //handle touchmove event
    let yDown = null;

    function handleTouchStart(evt) {
      if (abletoswipe == true) {
      xDown = evt.touches[0].clientX;
      yDown = evt.touches[0].clientY;
      }
    };

    function handleTouchMove(evt) {
      if (!xDown || !yDown) {
        return;
      }

      let xUp = evt.touches[0].clientX;
      let yUp = evt.touches[0].clientY;

      let xDiff = xDown - xUp;
      let yDiff = yDown - yUp;

      // sensitivity threshold
      let sensitivity = 10;

      if (Math.abs(xDiff) > Math.abs(yDiff)) { // most significant
        if (Math.abs(xDiff) > sensitivity) { // beyond the sensitivity threshold.
          if (xDiff > 0) {
            // swiped left
            currentIndex = (currentIndex + 1) % totalDivs;
            showDiv(currentIndex);
          } else {
            // swiped right
            currentIndex = (currentIndex - 1 + totalDivs) % totalDivs;
            showDiv(currentIndex);
          }
        }
      }

      // Reset values.
      xDown = null;
      yDown = null;
    };

    // when you swipe to the right the index increments 
    // and when you swipe to the left the index decrements
    const touchstart = document.addEventListener("touchstart", handleTouchStart, false);
    const touchmove = document.addEventListener("touchmove", handleTouchMove, false);
    let xDown = null;
    if (touchstart) {
        // recognise if its being swiped to the left or right
        if (touchmove) {
            // if its being swiped to the left, increment the index
            if (canNavigate) {
              if (xDown > 0) {
                currentIndex = (currentIndex + 1) % totalDivs;
                showDiv(currentIndex);
                changeIndex(currentIndex)
                select.currentTime = 0;
                select.volume = hovervolume;
                select.play();
              } else {
                if (xDown < 0) {
                  currentIndex = (currentIndex - 1 + totalDivs) % totalDivs;
                  showDiv(currentIndex);
                  changeIndex(currentIndex)
                  select.currentTime = 0;
                  select.volume = hovervolume;
                  select.play();
              }
            }
        }
  }
}

// div navigation
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");

prevButton.addEventListener("click", function () {
  if (canNavigate) {
      canNavigate = false;
      setTimeout(() => { canNavigate = true; }, cooldownDuration);

      currentIndex = (currentIndex - 1 + totalDivs) % totalDivs;
      showDiv(currentIndex);
      changeIndex(currentIndex);
      select.currentTime = 0;
      select.volume = hovervolume;
      select.play();
      previmg.src = "images/lefthover.webp";
  }
});

nextButton.addEventListener("click", function () {
  if (canNavigate) {
      canNavigate = false;
      setTimeout(() => { canNavigate = true; }, cooldownDuration);

      currentIndex = (currentIndex + 1) % totalDivs;
      showDiv(currentIndex);
      changeIndex(currentIndex);
      select.currentTime = 0;
      select.volume = hovervolume;
      select.play();
      nextimg.src = "images/righthover.webp";
  }
});


// keyboard navigation
document.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      if (canNavigate) {
        canNavigate = false;
        setTimeout(() => { canNavigate = true; }, cooldownDuration);
        
        currentIndex = (currentIndex - 1 + totalDivs) % totalDivs;
        showDiv(currentIndex);
        changeIndex(currentIndex)
        select.currentTime = 0;
        select.volume = hovervolume;
        select.play();
      }
      }
    }
);

document.addEventListener("keydown", function (event) {
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      if (canNavigate) {
        canNavigate = false;
        setTimeout(() => { canNavigate = true; }, cooldownDuration);
    
      currentIndex = (currentIndex + 1) % totalDivs;
      showDiv(currentIndex);
      changeIndex(currentIndex)
      select.currentTime = 0;
      select.volume = hovervolume;
      select.play();
      }
    }
  });
});

// social icons (defo a better way to do this)
const youtube = document.getElementById("youtube");
const discord = document.getElementById("discord"); 
const twitter = document.getElementById("twitter");
const twitch = document.getElementById("twitch"); 

youtube.addEventListener("mouseenter", function () {
  youtube.querySelector("img").src = youtube.querySelector("img").getAttribute("data-hover-src");
  hover.currentTime = 0;
  hover.volume = hovervolume;
hover.play();
});

youtube.addEventListener("mouseleave", function () {
  youtube.querySelector("img").src = youtube.querySelector("img").getAttribute("data-original-src");
});

youtube.addEventListener("click", function () {
	select.volume = hovervolume;
select.play();
});

discord.addEventListener("mouseenter", function () {
  discord.querySelector("img").src = discord.querySelector("img").getAttribute("data-hover-src");
  hover.currentTime = 0;
  hover.volume = hovervolume;
hover.play();
});

discord.addEventListener("mouseleave", function () {
  discord.querySelector("img").src = discord.querySelector("img").getAttribute("data-original-src");
});

discord.addEventListener("click", function () {
	select.volume = hovervolume;
select.play();
});

twitter.addEventListener("mouseenter", function () {
  twitter.querySelector("img").src = twitter.querySelector("img").getAttribute("data-hover-src");
  hover.currentTime = 0;
  hover.volume = hovervolume;
hover.play();
});

twitter.addEventListener("mouseleave", function () {
  twitter.querySelector("img").src = twitter.querySelector("img").getAttribute("data-original-src");
});

twitter.addEventListener("click", function () {
	select.volume = hovervolume;
select.play();
});

twitch.addEventListener("mouseenter", function () {
  twitch.querySelector("img").src = twitch.querySelector("img").getAttribute("data-hover-src");
  hover.currentTime = 0;
  hover.volume = hovervolume;
hover.play();
});

twitch.addEventListener("mouseleave", function () {
  twitch.querySelector("img").src = twitch.querySelector("img").getAttribute("data-original-src");
});

twitch.addEventListener("click", function () {
	select.volume = hovervolume;
select.play();
});

// music
const audios = [
  document.getElementById('audio1'),
  document.getElementById('audio2'),
  document.getElementById('audio3'),
  document.getElementById('audio4'),
  document.getElementById('audio5')
];

// play all at the same time, mute accordingly
function playAll() {
  audios.forEach(audio => {
      audio.play().then(() => {
          audio.volume = 0;
      }).catch(error => {
          console.error('Error playing audio:', error);
      });
  });
}

function switchMusic(pageNumber) {
  audios.forEach((audio, index) => {
      if (index === pageNumber - 1) {
          audio.volume = .325;
      } else {
          audio.volume = 0; 
      }
  });
}

// music controls
let music0 = "images/music0.webp"
let music1 = "images/music1.webp"
let music2 = "images/music2.webp"

let hovervolume = .175;
let toggleMusic = 1;
const playButton = document.getElementById('play');
playButton.addEventListener('click', function() {
    if (toggleMusic == 0) {
        toggleMusic = 1;
        updateMusicIcon();
    } else if (toggleMusic == 1) {
        toggleMusic = 2;
        updateMusicIcon()
    } else if (toggleMusic == 2) {
      toggleMusic = 0;
      updateMusicIcon()
    }});

function updateMusicIcon() {
  if (toggleMusic == 0) {
    playButton.querySelector("img").src = music0;
    audios.forEach(audio => audio.muted = true);
    hovervolume = 0;
  } else if (toggleMusic == 1) {
    playButton.querySelector("img").src = music1;
    audios.forEach(audio => audio.pause());
    hovervolume = .175;
  }
  else if (toggleMusic == 2) {
    playButton.querySelector("img").src = music2;
    audios.forEach(audio => audio.muted = false);
    playAll();
    switchMusic(index + 1);
    hovervolume = .175;
  }
}

// colors and index
const video = document.querySelector("#bgvid");
const index = document.getElementById("indeximg");
const portfolio = document.getElementById("vid");
const nav = document.querySelectorAll(".nav-button");
const filterValues = [0, 60, 130, 210, 300];
const NavFilterValues = [0, 40, 150, 210, 275];
let wrap = 0;

function changeIndex(index) {
  document.getElementById("indeximg").src = "images/index" + (index+1) + ".webp";

  // if the index is 3, the portfolio video should play
  if (index === 2) {
    portfolio.play();
  } else {
    portfolio.pause();
  }
  const filterValue = video.style.filter;
  const match = filterValue.match(/hue-rotate\(([-\d]+)deg\)/);
  let filterDeg;

  if (match) {
    filterDeg = parseInt(match[1]);
  } else {
    filterDeg = 0;
  }

  if (filterDeg === 300 + wrap && index === 0) {
    wrap += 360;
  } else if (filterDeg === 0 + wrap && index === 4) {
    wrap -= 360;
  }
  
  console.log("wrap is " + wrap);
  video.style.filter = `hue-rotate(${filterValues[index] + wrap}deg)`;
  nav.forEach(button => {
    button.style.filter = `hue-rotate(${NavFilterValues[index] + wrap}deg)`
  })
  indeximg.style.filter = `hue-rotate(${NavFilterValues[index] + wrap}deg)`
}

// nav buttons
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const previmg = prevButton.querySelector("img");
const nextimg = nextButton.querySelector("img");

nextButton.addEventListener("mouseenter", function () {
  nextimg.src = "images/righthover.webp";
  hover.currentTime = 0;
  hover.volume = hovervolume;
  hover.play();
});

nextButton.addEventListener("mouseleave", function () {
  nextimg.src = "images/right.webp";
});

prevButton.addEventListener("mouseenter", function () {
  previmg.src = "images/lefthover.webp";
  hover.currentTime = 0;
  hover.volume = hovervolume;
  hover.play();
});

prevButton.addEventListener("mouseleave", function () {
  previmg.src = "images/left.webp";
});

const infoButton = document.getElementById('info');
const backButton = document.getElementById('back');

function changeIcons() {
    infoButton.querySelector("img").src = "images/info.webp";
    backButton.querySelector("img").src = "images/back.webp";
    music0 = "images/music0.webp";
    music1 = "images/music1.webp";
    music2 = "images/music2.webp";
}

// NEW: if the mouse is still for a while, index, btn-group and nav buttons opacity = 0
const navButtons = document.querySelectorAll(".nav-button");

function Idle() {
  index.style.opacity = 0;
  navButtons.forEach(button => {
    if (button !== youtube && button !== discord && button !== twitter && button !== twitch) {
      button.style.opacity = 0;
    }
  });
}

function showContent() {
  index.style.opacity = 1;
  navButtons.forEach(button => {
      button.style.opacity = 1;
  });
}

let timeout;
const idleTime = 1000;

function handleMouseMove() {
    clearTimeout(timeout);
    showContent();
    timeout = setTimeout(() => {
      Idle();
    }, idleTime);
}


document.addEventListener('mousemove', handleMouseMove);

handleMouseMove();