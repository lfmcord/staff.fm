export class StaffMailType {
    public static Report = 'report';
    public static Crowns = 'crowns';
    public static Lastfm = 'lastfm';
    public static Server = 'server';
    public static Other = 'other';
    public static Staff = 'staff';
    public static UrgentReport = 'urgentreport';
    public static InServerReport = 'inserverreport';

    public static CrownsReport = `${StaffMailType.Crowns}-report`;
    public static CrownsBanInquiry = `${StaffMailType.Crowns}-baninquiry`;
    public static CrownsFalseCrown = `${StaffMailType.Crowns}-falsecrown`;
    public static CrownsOther = `${StaffMailType.Crowns}-other`;
}
