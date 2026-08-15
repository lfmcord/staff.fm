import { StaffMailType } from '@src/feature/models/staff-mail-type';

export class Constants {
    public static readonly Note: string = '📝';
    public static readonly User: string = '👤';
    public static readonly Deletion: string = '🗑️';
    public static readonly Hourglass: string = '⌛';
    public static readonly Loud: string = '🔊';
    public static readonly Mute: string = '🔇';
    public static readonly Hammer: string = '🔨';
    public static readonly Warning: string = '⚠️';
    public static readonly Information: string = 'ℹ️';
    public static readonly Flag: string = '🚩';
    public static readonly DownwardChart: string = '📉';
    public static readonly UpwardChart: string = '📈';
    public static readonly Crown: string = '👑';
    public static readonly Numbers: string = '🔢';
    public static readonly Blocked: string = '🚫';
    public static readonly Accepted: string = '☑️';
    public static readonly Outgoing: string = '📤';
    public static readonly Incoming: string = '📥';
    public static readonly Thread: string = '🧵';
    public static readonly EmptyPage: string = '📄';
    public static readonly Speech: string = '💬';
    public static readonly Time: string = '🕒';
    public static readonly Infinity: string = '♾️';
    public static readonly Stop: string = '⏹️';
    public static readonly Scream: string = '🗯️';
    public static readonly Lastfm: string = '<:lastfmred:900551196023083048>';
    public static readonly Wildcard: string = '🃏';
    public static readonly Music: string = '🎵';

    public static readonly StaffMailCategories: { [key: string]: string } = {
        [StaffMailType.Crowns]: Constants.Crown + ' Crowns',
        [StaffMailType.Report]: Constants.Flag + 'Report or Moderation concern',
        [StaffMailType.Lastfm]: Constants.Music + ' Last.fm-related',
        [StaffMailType.Server]: Constants.Speech + ' Server-related',
        [StaffMailType.Other]: Constants.Wildcard + ' Other',
    };

    public static readonly StaffMailCategoriesSimple: { [key: string]: string } = {
        [StaffMailType.Crowns]: 'Crowns',
        [StaffMailType.Report]: 'Report or Moderation concern',
        [StaffMailType.Lastfm]: 'Last.fm-related',
        [StaffMailType.Server]: 'Server-related',
        [StaffMailType.Other]: 'Other',
    };
}
