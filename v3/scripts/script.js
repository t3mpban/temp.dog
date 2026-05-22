// - temp <3

let otherIndex = 0;

let abletoswipe = true;

  // Set up parallax effect
const layers = document.querySelectorAll('.layer');
const strength = [.05, .035, 0.02]; // Adjust strength of parallax for each layer

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

document.addEventListener("DOMContentLoaded", function () {
  const contentContainer = document.querySelector(".content-container");
  const navButtons = document.querySelectorAll(".nav-button");
  const showContentButton = document.getElementById("showContentButton");
  const showContentButtonDiv = document.getElementById("showContentButtonDiv");
  const index = document.getElementById("index");

  const svgFiles = [
      'frame1.svg',
      'frame2.svg',
      'frame3.svg',
      'frame4.svg',
      'frame5.svg',
  ];

  function preloadImages() {
      for (let i = 0; i < svgFiles.length; i++) {
          const img = new Image();
          img.src = "images/" + svgFiles[i];
      }
  }

  preloadImages();

  fade();
});

function fade() {
  const animationContainer = document.getElementById("animation-container");
  animationContainer.style.opacity = 0;
  setTimeout(function () {
      let opacity = 0;
      const fadeInInterval = setInterval(function () {
          if (opacity >= 1) {
              clearInterval(fadeInInterval);
          } else {
              opacity += 0.02;
              animationContainer.style.opacity = opacity
          }
      }, 25);
  });
}

const hover = document.getElementById("hover"); 
const select = document.getElementById("select"); 

document.addEventListener('mouseover', (e) => {
  if (e.target.closest('[href*="https://"], [href*="mailto:"], [href*="discord://"]') !== null) {
    hover.currentTime = 0;
    hover.volume = hovervolume;
hover.play();
  }
});

document.addEventListener('click', (e) => {
  if (e.target.closest('[href*="https://"]') !== null) {
    select.volume = hovervolume;
select.play();
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const silentAudio = document.getElementById('silentAudio');

  silentAudio.play().then(() => {
      silentAudio.pause();
  });

    let currentIndex = 0;
    const totalDivs = 5;
    const divs = document.querySelectorAll(".div-content");

    const backgroundColors = [
        "#ffd7b4", // div1
        "#9efffc", // div2
        "#9966cc", // div3
        "#da2c43", // div4
        "#050511"  // div5
    ];

    function update() {
      setInterval(() => {
          switchMusic(currentIndex + 1); 
      }, 100); 
  }

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
        document.body.style.backgroundColor = backgroundColors[index];
        currentIndex = index;
        changeIndex(currentIndex);
        otherIndex=currentIndex;
        changeIcons()
        updateMusicIcon()
        if (otherIndex == 0) {
          nextimg.src = "images/right-div1.webp";
        } else if (otherIndex == 1) {
          nextimg.src = "images/right-div2.webp";
        } else if (otherIndex == 2) {
          nextimg.src = "images/right-div3.webp";
        } else if (otherIndex == 3) {
          nextimg.src = "images/right-div4.webp";
        } else if (otherIndex == 4) {
          nextimg.src = "images/right-div5.webp";
        }
        if (otherIndex == 0) {
          previmg.src = "images/left-div1.webp";
        } else if (otherIndex == 1) {
          previmg.src = "images/left-div2.webp";
        } else if (otherIndex == 2) {
          previmg.src = "images/left-div3.webp";
        } else if (otherIndex == 3) {
          previmg.src = "images/left-div4.webp";
        } else if (otherIndex == 4) {
          previmg.src = "images/left-div5.webp";
        }
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

      if (Math.abs(xDiff) > Math.abs(yDiff)) { // Most significant.
        if (Math.abs(xDiff) > sensitivity) { // Beyond the sensitivity threshold.
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

    // write a script that when you swipe to the right the index increments
    // and when you swipe to the left the index decrements
    const touchstart = document.addEventListener("touchstart", handleTouchStart, false);
    const touchmove = document.addEventListener("touchmove", handleTouchMove, false);
    let xDown = null;
    if (touchstart) {
        //recognise if its being swiped to the left or right
        if (touchmove) {
            // if its being swiped to the left, increment the index
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

const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");

prevButton.addEventListener("click", function () {
    currentIndex = (currentIndex - 1 + totalDivs) % totalDivs;
    showDiv(currentIndex);
    changeIndex(currentIndex)
    select.currentTime = 0;
    select.volume = hovervolume;
    select.play();
    if (otherIndex == 0) {
      previmg.src = "images/lefthover-div1.webp";
    } else if (otherIndex == 1) {
      previmg.src = "images/lefthover-div2.webp";
    } else if (otherIndex == 2) {
      previmg.src = "images/lefthover-div3.webp";
    } else if (otherIndex == 3) {
      previmg.src = "images/lefthover-div4.webp";
    } else if (otherIndex == 4) {
      previmg.src = "images/lefthover-div5.webp";
    }
});

nextButton.addEventListener("click", function () {
    currentIndex = (currentIndex + 1) % totalDivs;
    showDiv(currentIndex);
    changeIndex(currentIndex)
    select.currentTime = 0;
    select.volume = hovervolume;
    select.play();
    if (otherIndex == 0) {
      nextimg.src = "images/righthover-div1.webp";
    } else if (otherIndex == 1) {
      nextimg.src = "images/righthover-div2.webp";
    } else if (otherIndex == 2) {
      nextimg.src = "images/righthover-div3.webp";
    } else if (otherIndex == 3) {
      nextimg.src = "images/righthover-div4.webp";
    } else if (otherIndex == 4) {
      nextimg.src = "images/righthover-div5.webp";
    }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "ArrowLeft" || event.key === "a") {
    currentIndex = (currentIndex - 1 + totalDivs) % totalDivs;
    showDiv(currentIndex);
    changeIndex(currentIndex)
    select.currentTime = 0;
    select.volume = hovervolume;
select.play();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "ArrowRight" || event.key === "d") {
    currentIndex = (currentIndex + 1) % totalDivs;
    showDiv(currentIndex);
    changeIndex(currentIndex)
    select.currentTime = 0;
    select.volume = hovervolume;
select.play();
  }
});
});

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

const audios = [
  document.getElementById('audio1'),
  document.getElementById('audio2'),
  document.getElementById('audio3'),
  document.getElementById('audio4'),
  document.getElementById('audio5')
];

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

let music0 = "images/music0-div1.webp"
let music1 = "images/music1-div1.webp"
let music2 = "images/music2-div1.webp"

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


// get all svg files named index1.svg, index2.svg, etc to index5.svg, and when this function is called, it will change the src of the svg to the corresponding index. there is already a "indeximg" id in the html file, so you can just change the src of that element. 
function changeIndex(index) {   
  document.getElementById("indeximg").src = "images/index" + (index+1) + ".webp";
}

const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const previmg = prevButton.querySelector("img");
const nextimg = nextButton.querySelector("img");

nextButton.addEventListener("mouseenter", function () {
  console.log(otherIndex)
  if (otherIndex == 0) {
    nextimg.src = "images/righthover-div1.webp";
  } else if (otherIndex == 1) {
    nextimg.src = "images/righthover-div2.webp";
  } else if (otherIndex == 2) {
    nextimg.src = "images/righthover-div3.webp";
  } else if (otherIndex == 3) {
    nextimg.src = "images/righthover-div4.webp";
  } else if (otherIndex == 4) {
    nextimg.src = "images/righthover-div5.webp";
  }
  hover.currentTime = 0;
  hover.volume = hovervolume;
  hover.play();
});

nextButton.addEventListener("mouseleave", function () {
  console.log(otherIndex)
  if (otherIndex == 0) {
    nextimg.src = "images/right-div1.webp";
  } else if (otherIndex == 1) {
    nextimg.src = "images/right-div2.webp";
  } else if (otherIndex == 2) {
    nextimg.src = "images/right-div3.webp";
  } else if (otherIndex == 3) {
    nextimg.src = "images/right-div4.webp";
  } else if (otherIndex == 4) {
    nextimg.src = "images/right-div5.webp";
  }
});

prevButton.addEventListener("mouseenter", function () {
  console.log(otherIndex)
  if (otherIndex == 0) {
    previmg.src = "images/lefthover-div1.webp";
  } else if (otherIndex == 1) {
    previmg.src = "images/lefthover-div2.webp";
  } else if (otherIndex == 2) {
    previmg.src = "images/lefthover-div3.webp";
  } else if (otherIndex == 3) {
    previmg.src = "images/lefthover-div4.webp";
  } else if (otherIndex == 4) {
    previmg.src = "images/lefthover-div5.webp";
  }
  hover.currentTime = 0;
  hover.volume = hovervolume;
  hover.play();
});

prevButton.addEventListener("mouseleave", function () {
  console.log(otherIndex)
  if (otherIndex == 0) {
    previmg.src = "images/left-div1.webp";
  } else if (otherIndex == 1) {
    previmg.src = "images/left-div2.webp";
  } else if (otherIndex == 2) {
    previmg.src = "images/left-div3.webp";
  } else if (otherIndex == 3) {
    previmg.src = "images/left-div4.webp";
  } else if (otherIndex == 4) {
    previmg.src = "images/left-div5.webp";
  } 
});

const infoButton = document.getElementById('info');
const backButton = document.getElementById('back');

function changeIcons() {
  if (otherIndex == 0) {
    infoButton.querySelector("img").src = "images/info-div1.webp";
    backButton.querySelector("img").src = "images/back-div1.webp";
    music0 = "images/music0-div1.webp";
    music1 = "images/music1-div1.webp";
    music2 = "images/music2-div1.webp";
  } else if (otherIndex == 1) {
    infoButton.querySelector("img").src = "images/info-div2.webp";
    backButton.querySelector("img").src = "images/back-div2.webp";
    music0 = "images/music0-div2.webp";
    music1 = "images/music1-div2.webp";
    music2 = "images/music2-div2.webp";
  } else if (otherIndex == 2) {
    infoButton.querySelector("img").src = "images/info-div3.webp";
    backButton.querySelector("img").src = "images/back-div3.webp";
    music0 = "images/music0-div3.webp";
    music1 = "images/music1-div3.webp";
    music2 = "images/music2-div3.webp";
  } else if (otherIndex == 3) {
    infoButton.querySelector("img").src = "images/info-div4.webp";
    backButton.querySelector("img").src = "images/back-div4.webp";
    music0 = "images/music0-div4.webp";
    music1 = "images/music1-div4.webp";
    music2 = "images/music2-div4.webp";
  } else if (otherIndex == 4) {
    infoButton.querySelector("img").src = "images/info-div5.webp";
    backButton.querySelector("img").src = "images/back-div5.webp";
    music0 = "images/music0-div5.webp";
    music1 = "images/music1-div5.webp";
    music2 = "images/music2-div5.webp";
  }
}