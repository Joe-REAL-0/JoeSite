"""
工具函数模块，提供通用功能
"""
from datetime import datetime, timezone, timedelta

def get_china_time(format_str="%Y-%m-%d %H:%M:%S"):
    """
    获取东八区（中国）时间
    
    Args:
        format_str (str): 时间格式字符串，默认为 "%Y-%m-%d %H:%M:%S"
    
    Returns:
        str: 格式化的东八区时间字符串
    """
    utc_now = datetime.now(timezone.utc)
    china_timezone = timezone(timedelta(hours=8))
    china_time = utc_now.astimezone(china_timezone)
    return china_time.strftime(format_str)
