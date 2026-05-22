(function() {
    const layer1 = document.getElementById('layer1');
    const layer2 = document.getElementById('layer2');
    const layer3 = document.getElementById('layer3');
  
    // Normalize values: map tilt range to px shift range
    const maxTilt = 30; // degrees
    const maxShift = 30; // px
  
    function mapRange(value, inMin, inMax, outMin, outMax) {
      return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }
  
    function applyParallax(xTilt, yTilt) {
      // Map x/y tilt from -maxTilt..maxTilt to -maxShift..maxShift
      const xShift = mapRange(xTilt, -maxTilt, maxTilt, -maxShift, maxShift);
      const yShift = mapRange(yTilt, -maxTilt, maxTilt, -maxShift, maxShift);
  
      // Parallax strength per layer
      layer3.style.transform = `translate(${xShift * 0.2}px, ${yShift * 0.2}px)`;
      layer2.style.transform = `translate(${xShift * 0.3}px, ${yShift * 0.3}px)`;
      layer1.style.transform = `translate(${xShift * .4}px, ${yShift * .4}px)`;
    }
  
    function handleOrientation(event) {
      const x = event.gamma || 0; // left to right
      const y = event.beta || 0;  // front to back
      applyParallax(x, y);
    }
  
    function enableOrientation() {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+
        DeviceOrientationEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation, true);
            } else {
              alert('Permission to access device orientation was denied.');
            }
          }).catch(console.error);
      } else {
        // Non-iOS
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    }
  
    // Trigger permission request on user interaction
    window.addEventListener('click', enableOrientation, { once: true });
  })();