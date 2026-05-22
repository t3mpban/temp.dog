// - temp <3
 
let abletoswipe = false;

document.addEventListener("DOMContentLoaded", function () {
  const contentContainer = document.querySelector(".content-container");
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
  const topText = document.getElementById("top-text");

  window.mobileAndTabletCheck = function() {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
  };

    setTimeout(function() {
      let opacity = 1;
      const fadeOutInterval = setInterval(function () {
      if (opacity <= 0) {
        clearInterval(fadeOutInterval);
      } else {
        opacity -= 0.01;
        topText.style.opacity = opacity;
    }}, 10);}, 1000);

  function preloadImages() {
    for (let i = 0; i < svgFiles.length; i++) {
        const img = new Image();
        img.src = "../images/" + svgFiles[i];
    }
}

  preloadImages();

  contentContainer.style.display = "none";

  showContentButton.addEventListener("click", function () {
      contentContainer.style.display = "flex";
      showContentButtonDiv.style.display = "none";
      index.style.display = "block";
      abletoswipe = true;
      fade();
  });
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
    hover.play();
  }
});

document.addEventListener('click', (e) => {
  if (e.target.closest('[href*="https://"]') !== null) {
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
        "#ffcc00", // div1
        "#60eeaa", // div2
        "#8030cc", // div3
        "#dd3030", // div4
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
        
        switchMusic([index+1]); 
        document.body.style.backgroundColor = backgroundColors[index];
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
            changeIndex(currentIndex)
          } else {
            // swiped right
            currentIndex = (currentIndex - 1 + totalDivs) % totalDivs;
            showDiv(currentIndex);
            changeIndex(currentIndex)
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
              select.play();
              console.log(currentIndex)
            } else {
              if (xDown < 0) {
                currentIndex = (currentIndex - 1 + totalDivs) % totalDivs;
                showDiv(currentIndex);
                changeIndex(currentIndex)
                select.currentTime = 0;
                select.play();
                console.log(currentIndex)
                
            }
        }
  }
}

document.addEventListener("keydown", function (event) {
  if (event.key === "ArrowLeft" || event.key === "a") {
    currentIndex = (currentIndex - 1 + totalDivs) % totalDivs;
    showDiv(currentIndex);
    changeIndex(currentIndex)
    select.currentTime = 0;
    select.play();
    console.log(currentIndex);
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "ArrowRight" || event.key === "d") {
    currentIndex = (currentIndex + 1) % totalDivs;
    showDiv(currentIndex);
    changeIndex(currentIndex)
    select.currentTime = 0;
    select.play();
    console.log(currentIndex);
  }
});
});

const youtube = document.getElementById("youtube");
const discord = document.getElementById("discord"); 
const twitter = document.getElementById("twitter");
const twitch = document.getElementById("twitch"); 

youtube.addEventListener("click", function () {
	select.play();
});

discord.addEventListener("click", function () {
	select.play();
});

twitter.addEventListener("click", function () {
	select.play();
});

twitch.addEventListener("click", function () {
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
          audio.volume = 1;
      } else {
          audio.volume = 0; 
      }
  });
}

// get all svg files named index1.svg, index2.svg, etc to index5.svg, and when this function is called, it will change the src of the svg to the corresponding index. there is already a "indeximg" id in the html file, so you can just change the src of that element. 
function changeIndex(index) {   
  document.getElementById("indeximg").src = "../images/index" + (index+1) + ".svg";
}