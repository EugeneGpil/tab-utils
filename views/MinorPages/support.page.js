import React from 'react';
import {getPageConfig} from '../PageWrapper';

export default getPageConfig(
  () => <>
    Your Clock Tab doesn't work? Check out <a href="/bug-repair">Bug Repair</a>.

    <p>
    You have a suggestion? Check out <a href="/feature-suggestion">Feature Suggestion</a>.
    </p>

    <p>
    Otherwise, write an email to <a className="contact-address"></a>.
    </p>
  </>,
  'Support',
);
