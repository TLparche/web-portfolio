import test from 'node:test';
import assert from 'node:assert/strict';
import {textOpacity,contentEnterStart,contentExitEnd} from '../app/portfolio/timeline.mjs';

test('the native fade clears reading content before the next section enters',()=>{
  for(const [effect,exit,enter] of [['fade',.3,.55]]){
    assert.equal(contentExitEnd(effect),exit);
    assert.equal(contentEnterStart(effect),enter);
    assert.equal(textOpacity(0,{index:0,next:1,transition:0,effect}),1);
    assert.equal(textOpacity(1,{index:0,next:1,transition:1,effect}),1);
    for(let step=0;step<=100;step++){
      const state={index:0,next:1,transition:step/100,effect};
      assert.equal(textOpacity(2,state),0);
      assert.ok(!(textOpacity(0,state)>0 && textOpacity(1,state)>0));
      if(state.transition>=exit && state.transition<=enter){assert.equal(textOpacity(0,state),0);assert.equal(textOpacity(1,state),0);}
      if(state.transition>enter && state.transition<1)assert.ok(textOpacity(1,state)>0 && textOpacity(1,state)<1);
    }
  }
});
