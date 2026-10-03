export abstract class RealtimePublisher {
  abstract publish(channel: string, event: object): Promise<void>;
}

export class NoopRealtimePublisher extends RealtimePublisher {
  async publish(_channel: string, _event: object) {}
}
