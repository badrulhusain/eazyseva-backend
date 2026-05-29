import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(user: CurrentUserType): Promise<{
        success: boolean;
        data: any;
    }>;
    updateMe(user: CurrentUserType, dto: UpdateProfileDto): Promise<{
        success: boolean;
        data: any;
    }>;
}
