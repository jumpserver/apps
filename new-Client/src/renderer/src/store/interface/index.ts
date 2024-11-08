export interface IUserInfo {
  name?: string;

  username: string;

  display_name: Array<string>;

  avatar_url: string;

  value?: string;

  token: string;
}

export interface IUser {
  token: string;

  currentSite: string;

  userInfo: IUserInfo[];

  loading: boolean;

  currentUser: Partial<IUserInfo>;
}
