import { NORMAL_APPLICATION_PATH } from './app.paths';

describe('application paths', () => {
  it('uses home as the normal authenticated destination', () => {
    expect(NORMAL_APPLICATION_PATH).toBe('/home');
  });
});
