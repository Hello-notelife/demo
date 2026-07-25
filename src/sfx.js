window.SFX = (function () {
  var context = null;
  var enabled = false;

  function audioContext() {
    if (!enabled) return null;
    if (!context) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
    }
    if (context.state === 'suspended') context.resume();
    return context;
  }

  function tone(frequency, duration, type, volume, delay) {
    var audio = audioContext();
    if (!audio) return;
    var start = audio.currentTime + (delay || 0);
    var oscillator = audio.createOscillator();
    var gain = audio.createGain();
    oscillator.type = type || 'square';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || .04, start + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }

  function sequence(notes) {
    notes.forEach(function (note) {
      tone(note[0], note[1], note[2], note[3], note[4]);
    });
  }

  return {
    setEnabled: function (value) { enabled = !!value; },
    blip: function () { tone(660, .045, 'square', .025, 0); },
    select: function () {
      sequence([[523, .06, 'square', .04, 0], [784, .08, 'square', .045, .05]]);
    },
    back: function () {
      sequence([[440, .06, 'square', .04, 0], [294, .09, 'square', .04, .05]]);
    },
    warn: function () {
      sequence([[311, .08, 'sawtooth', .04, 0], [233, .12, 'sawtooth', .045, .08]]);
    },
    coin: function () {
      sequence([[988, .05, 'square', .04, 0], [1319, .06, 'square', .045, .05]]);
    },
    fork: function () {
      sequence([[392, .06, 'square', .04, 0], [523, .06, 'square', .04, .05], [659, .1, 'square', .045, .1]]);
    },
    shift: function () {
      sequence([[330, .05, 'square', .04, 0], [494, .05, 'square', .04, .05], [740, .1, 'square', .045, .1]]);
    },
    success: function () {
      sequence([[523, .07, 'square', .045, 0], [659, .07, 'square', .045, .07], [784, .08, 'square', .045, .14], [1047, .18, 'square', .05, .21]]);
    },
    fail: function () {
      sequence([[294, .1, 'sawtooth', .04, 0], [220, .14, 'sawtooth', .045, .1], [147, .22, 'square', .04, .24]]);
    }
  };
})();
