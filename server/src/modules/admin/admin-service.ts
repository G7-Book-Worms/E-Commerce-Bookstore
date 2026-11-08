import { AdminRepository } from './admin-repository';

export class AdminService {
  constructor(private adminRepo = new AdminRepository()) {}

  async getOverview() {
    return this.adminRepo.getSystemCounts();
  }
}