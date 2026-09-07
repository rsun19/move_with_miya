import { of } from 'rxjs';
import { LocationController } from './LocationController';

describe('LocationController', () => {
  let controller: LocationController;
  let client: { send: jest.Mock };

  beforeEach(() => {
    client = { send: jest.fn().mockReturnValue(of('result')) };
    controller = new LocationController(client as never);
  });

  it('forwards public location reads', () => {
    expect(controller.findLocations()).toBeDefined();
    expect(controller.findLocation(3)).toBeDefined();
    expect(client.send).toHaveBeenNthCalledWith(
      1,
      { cmd: 'get_locations' },
      {},
    );
    expect(client.send).toHaveBeenNthCalledWith(
      2,
      { cmd: 'get_location' },
      { id: 3 },
    );
  });

  it('forwards admin location mutations', () => {
    controller.createLocation({ name: 'Studio' });
    controller.updateLocation(3, { city: 'Boston' });
    controller.deleteLocation(3);
    expect(client.send).toHaveBeenNthCalledWith(
      1,
      { cmd: 'create_location' },
      { name: 'Studio' },
    );
    expect(client.send).toHaveBeenNthCalledWith(
      2,
      { cmd: 'update_location' },
      { city: 'Boston', id: 3 },
    );
    expect(client.send).toHaveBeenNthCalledWith(
      3,
      { cmd: 'delete_location' },
      { id: 3 },
    );
  });
});
